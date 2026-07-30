import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('RepoIndexer');
// ── Regex patterns for symbol extraction ──
const PATTERNS = [
    // export function foo(...
    { regex: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function', nameGroup: 1 },
    // export class Foo {...
    { regex: /export\s+(?:abstract\s+)?class\s+(\w+)/g, kind: 'class', nameGroup: 1 },
    // export interface IFoo {...
    { regex: /export\s+interface\s+(\w+)/g, kind: 'interface', nameGroup: 1 },
    // export type Foo = ...
    { regex: /export\s+type\s+(\w+)/g, kind: 'type', nameGroup: 1 },
    // export const foo = ...
    { regex: /export\s+const\s+(\w+)/g, kind: 'const', nameGroup: 1 },
    // export enum Foo {...
    { regex: /export\s+enum\s+(\w+)/g, kind: 'enum', nameGroup: 1 },
    // export { foo, bar }
    { regex: /export\s*\{\s*([^}]+)\s*\}/g, kind: 'export', nameGroup: 1 },
    // function foo( (non-exported)
    { regex: /(?:^|\s)(?:async\s+)?function\s+(\w+)/gm, kind: 'function', nameGroup: 1 },
    // class Foo (non-exported)
    { regex: /(?:^|\s)class\s+(\w+)/gm, kind: 'class', nameGroup: 1 },
];
const IMPORT_PATTERN = /import\s+(?:(?:\{([^}]+)\})|(?:(?:type\s+)?(\w+))|(?:\*\s+as\s+(\w+)))?\s*(?:,\s*(?:\{([^}]+)\}|(\w+)))?\s*from\s*['"]([^'"]+)['"]/g;
// ── Ignored patterns ──
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.turbo', '.nexus', '__pycache__']);
const IGNORE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.db', '.lock']);
// ── RepoIndexer ──
export class RepoIndexer {
    files = new Map();
    symbolIndex = new Map();
    rootPath;
    constructor(rootPath) {
        this.rootPath = path.resolve(rootPath);
    }
    /**
     * Walk the entire repo and build the full index.
     * Returns the number of files indexed.
     */
    async index() {
        logger.info(`Indexing repository at: ${this.rootPath}`);
        this.files.clear();
        this.symbolIndex.clear();
        await this.walkDirectory(this.rootPath);
        // Second pass: resolve import targets to build dependency edges
        this.resolveImports();
        logger.info(`Indexed ${this.files.size} files with ${this.symbolIndex.size} unique symbols.`);
        return this.files.size;
    }
    /**
     * Search for symbols by name (fuzzy partial match).
     */
    searchSymbols(query) {
        const lower = query.toLowerCase();
        const results = [];
        for (const [name, entries] of this.symbolIndex) {
            if (name.toLowerCase().includes(lower)) {
                results.push(...entries);
            }
        }
        return results.slice(0, 100);
    }
    /**
     * Search files by path pattern.
     */
    searchFiles(pattern) {
        const lower = pattern.toLowerCase();
        return Array.from(this.files.values())
            .filter(f => f.relativePath.toLowerCase().includes(lower))
            .slice(0, 50);
    }
    /**
     * Get the dependency graph for the entire repo or a specific file.
     */
    getDependencyGraph(filePath) {
        const edges = [];
        for (const file of this.files.values()) {
            if (filePath && file.relativePath !== filePath)
                continue;
            for (const imp of file.imports) {
                // Try to resolve the import to an actual file in the index
                const resolved = this.resolveImportPath(file.relativePath, imp.source);
                if (resolved && this.files.has(resolved)) {
                    edges.push({
                        from: file.relativePath,
                        to: resolved,
                        symbols: imp.symbols,
                    });
                }
            }
        }
        return edges;
    }
    /**
     * Get all files that import from a specific file.
     */
    getDependents(filePath) {
        return Array.from(this.files.values())
            .filter(f => f.exportedBy.includes(filePath));
    }
    /**
     * Get a summary of the indexed repository.
     */
    getSummary() {
        const byKind = {};
        const byExtension = {};
        for (const file of this.files.values()) {
            byExtension[file.extension] = (byExtension[file.extension] || 0) + 1;
            for (const sym of file.symbols) {
                byKind[sym.kind] = (byKind[sym.kind] || 0) + 1;
            }
        }
        // Most-depended-on files
        const depsByFile = Array.from(this.files.values())
            .map(f => ({ file: f.relativePath, count: f.exportedBy.length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
        // Count total unique symbols
        let totalSymbols = 0;
        for (const entries of this.symbolIndex.values()) {
            totalSymbols += entries.length;
        }
        return {
            totalFiles: this.files.size,
            totalSymbols,
            byKind,
            byExtension,
            topDependencies: depsByFile,
        };
    }
    // ── Private methods ──
    async walkDirectory(dirPath) {
        let entries;
        try {
            entries = await fs.readdir(dirPath, { withFileTypes: true });
        }
        catch (err) {
            logger.warn(`Cannot read directory ${dirPath}: ${err.message}`);
            return;
        }
        const promises = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
                    promises.push(this.walkDirectory(path.join(dirPath, entry.name)));
                }
            }
            else {
                const ext = path.extname(entry.name);
                if (!IGNORE_EXTENSIONS.has(ext)) {
                    promises.push(this.indexFile(path.join(dirPath, entry.name)));
                }
            }
        }
        await Promise.all(promises);
    }
    async indexFile(filePath) {
        const relativePath = path.relative(this.rootPath, filePath);
        const ext = path.extname(filePath);
        try {
            const stat = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            const symbols = this.extractSymbols(content, relativePath);
            const imports = this.extractImports(content, relativePath);
            const fileIndex = {
                path: filePath,
                relativePath,
                extension: ext,
                size: stat.size,
                symbols,
                imports,
                exportedBy: [],
            };
            this.files.set(relativePath, fileIndex);
            // Build symbol index
            for (const sym of symbols) {
                const existing = this.symbolIndex.get(sym.name) || [];
                existing.push(sym);
                this.symbolIndex.set(sym.name, existing);
            }
            logger.debug(`Indexed: ${relativePath} (${symbols.length} symbols, ${imports.length} imports)`);
        }
        catch (err) {
            logger.warn(`Failed to index ${relativePath}: ${err.message}`);
        }
    }
    extractSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');
        for (const { regex, kind, nameGroup } of PATTERNS) {
            // Create a fresh copy per file — avoids global regex lastIndex corruption
            const regexCopy = new RegExp(regex.source, regex.flags);
            let match;
            while ((match = regexCopy.exec(content)) !== null) {
                const rawNames = match[nameGroup];
                if (!rawNames)
                    continue;
                // Handle export { a, b, c } — split on commas
                const names = kind === 'export'
                    ? rawNames.split(',').map(s => s.trim()).filter(s => s.length > 0)
                    : [rawNames];
                for (const name of names) {
                    // Strip type annotations like "as Type" from exports
                    const cleanName = name.split(/\s+as\s+/)[0].trim();
                    // Find line number
                    const matchIndex = match.index;
                    let line = 1;
                    let pos = 0;
                    for (let i = 0; i < lines.length; i++) {
                        if (pos + lines[i].length + 1 > matchIndex) {
                            line = i + 1;
                            break;
                        }
                        pos += lines[i].length + 1;
                    }
                    const isExported = kind === 'export' || content.substring(match.index, match.index + 7) === 'export ';
                    symbols.push({
                        name: cleanName,
                        kind: kind === 'export' ? 'export' : kind,
                        file: filePath,
                        line,
                        exported: isExported,
                    });
                }
            }
        }
        // Deduplicate by name+kind
        const seen = new Set();
        return symbols.filter(s => {
            const key = `${s.name}:${s.kind}:${s.line}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    extractImports(content, filePath) {
        const imports = [];
        let match;
        // Reset lastIndex
        const regex = new RegExp(IMPORT_PATTERN.source, 'g');
        while ((match = regex.exec(content)) !== null) {
            const namedImports = match[1]; // { a, b }
            const defaultImport = match[2] || match[5]; // default or type default
            const namespaceImport = match[3];
            const source = match[6];
            const typeNamed = match[4];
            if (!source)
                continue;
            const allNamed = [
                ...(namedImports ? namedImports.split(',').map(s => s.trim()).filter(s => s.length > 0) : []),
                ...(typeNamed ? typeNamed.split(',').map(s => s.trim()).filter(s => s.length > 0) : []),
            ];
            imports.push({
                source,
                symbols: allNamed,
                defaultImport: defaultImport || undefined,
                namespaceImport: namespaceImport || undefined,
                isRelative: source.startsWith('.'),
            });
        }
        return imports;
    }
    resolveImports() {
        for (const file of this.files.values()) {
            for (const imp of file.imports) {
                const resolved = this.resolveImportPath(file.relativePath, imp.source);
                if (resolved && this.files.has(resolved)) {
                    const target = this.files.get(resolved);
                    if (!target.exportedBy.includes(file.relativePath)) {
                        target.exportedBy.push(file.relativePath);
                    }
                }
            }
        }
    }
    /**
     * Resolve a TypeScript import path to a relative file path in the repo.
     */
    resolveImportPath(fromFile, importSource) {
        // Skip external packages
        if (!importSource.startsWith('.') && !importSource.startsWith('@ai-agent-platform')) {
            return null;
        }
        const fromDir = path.dirname(fromFile);
        if (importSource.startsWith('.')) {
            // Relative import
            let resolved = path.normalize(path.join(fromDir, importSource));
            // Try exact match
            if (this.files.has(resolved))
                return resolved;
            // Try with extensions
            for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.js']) {
                if (this.files.has(resolved + ext))
                    return resolved + ext;
            }
            return null;
        }
        // Workspace package imports: @ai-agent-platform/shared → packages/shared/src/index.ts
        if (importSource.startsWith('@ai-agent-platform/')) {
            const pkg = importSource.replace('@ai-agent-platform/', '');
            const candidates = [
                `packages/${pkg}/src/index.ts`,
                `packages/${pkg}/src/index.js`,
                `packages/${pkg}/index.ts`,
                // Domains live under packages/domains/
                `packages/domains/${pkg}/src/index.ts`,
                `packages/domains/${pkg}/src/index.js`,
            ];
            for (const c of candidates) {
                if (this.files.has(c))
                    return c;
            }
        }
        return null;
    }
}
//# sourceMappingURL=repo-indexer.js.map