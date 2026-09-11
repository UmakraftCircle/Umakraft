import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('RepoIndexer');

// ── Types ──

export interface SymbolEntry {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum' | 'export';
  file: string;
  line: number;
  exported: boolean;
}

export interface FileIndex {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
  symbols: SymbolEntry[];
  imports: ImportEntry[];
  exportedBy: string[]; // files that import from this file
}

export interface ImportEntry {
  source: string;       // the import path (e.g. './foo.js' or '@ai-agent-platform/shared')
  symbols: string[];    // named imports
  defaultImport?: string;
  namespaceImport?: string;
  isRelative: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  symbols: string[];
}

export interface QueryResult {
  files: FileIndex[];
  symbols: SymbolEntry[];
  dependencies: DependencyEdge[];
}

// ── Regex patterns for symbol extraction ──

const PATTERNS: Array<{ regex: RegExp; kind: SymbolEntry['kind']; nameGroup: number }> = [
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
  private files: Map<string, FileIndex> = new Map();
  private symbolIndex: Map<string, SymbolEntry[]> = new Map();
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Walk the entire repo and build the full index.
   * Returns the number of files indexed.
   */
  public async index(): Promise<number> {
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
  public searchSymbols(query: string): SymbolEntry[] {
    const lower = query.toLowerCase();
    const results: SymbolEntry[] = [];

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
  public searchFiles(pattern: string): FileIndex[] {
    const lower = pattern.toLowerCase();
    return Array.from(this.files.values())
      .filter(f => f.relativePath.toLowerCase().includes(lower))
      .slice(0, 50);
  }

  /**
   * Get the dependency graph for the entire repo or a specific file.
   */
  public getDependencyGraph(filePath?: string): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    for (const file of this.files.values()) {
      if (filePath && file.relativePath !== filePath) continue;

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
   * Get all files that import FROM the given file (its dependents).
   */
  public getDependents(filePath: string): FileIndex[] {
    const target = this.files.get(filePath);
    if (!target) return [];
    return target.exportedBy
      .map(p => this.files.get(p))
      .filter((f): f is FileIndex => f !== undefined);
  }

  /**
   * Get a summary of the indexed repository.
   */
  public getSummary(): {
    totalFiles: number;
    totalSymbols: number;
    byKind: Record<string, number>;
    byExtension: Record<string, number>;
    topDependencies: Array<{ file: string; count: number }>;
  } {
    const byKind: Record<string, number> = {};
    const byExtension: Record<string, number> = {};

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

  private async walkDirectory(dirPath: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err: any) {
      logger.warn(`Cannot read directory ${dirPath}: ${err.message}`);
      return;
    }

    const promises: Promise<void>[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          promises.push(this.walkDirectory(path.join(dirPath, entry.name)));
        }
      } else {
        const ext = path.extname(entry.name);
        if (!IGNORE_EXTENSIONS.has(ext)) {
          promises.push(this.indexFile(path.join(dirPath, entry.name)));
        }
      }
    }

    await Promise.all(promises);
  }

  private async indexFile(filePath: string): Promise<void> {
    const relativePath = path.relative(this.rootPath, filePath);
    const ext = path.extname(filePath);

    try {
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');

      const symbols = this.extractSymbols(content, relativePath);
      const imports = this.extractImports(content, relativePath);

      const fileIndex: FileIndex = {
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
    } catch (err: any) {
      logger.warn(`Failed to index ${relativePath}: ${err.message}`);
    }
  }

  private extractSymbols(content: string, filePath: string): SymbolEntry[] {
    const symbols: SymbolEntry[] = [];
    const lines = content.split('\n');

    // Precompute line offsets for O(log n) line-number lookup (audit #22)
    const lineOffsets: number[] = [0]; // start of line 0
    for (let i = 0; i < lines.length; i++) {
      lineOffsets.push(lineOffsets[i] + lines[i].length + 1); // +1 for newline
    }

    /** Binary search to find which line contains a given character offset. */
    const offsetToLine = (offset: number): number => {
      let lo = 0, hi = lineOffsets.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        if (lineOffsets[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1; // 1-based line number
    };

    for (const { regex, kind, nameGroup } of PATTERNS) {
      // Create a fresh copy per file — avoids global regex lastIndex corruption
      const regexCopy = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = regexCopy.exec(content)) !== null) {
        const rawNames = match[nameGroup];
        if (!rawNames) continue;

        // Handle export { a, b, c } — split on commas
        const names = kind === 'export'
          ? rawNames.split(',').map(s => s.trim()).filter(s => s.length > 0)
          : [rawNames];

        for (const name of names) {
          // Strip type annotations like "as Type" from exports
          const cleanName = name.split(/\s+as\s+/)[0].trim();

          // Find line number via binary search
          const line = offsetToLine(match.index);

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
    const seen = new Set<string>();
    return symbols.filter(s => {
      const key = `${s.name}:${s.kind}:${s.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private extractImports(content: string, filePath: string): ImportEntry[] {
    const imports: ImportEntry[] = [];
    let match;

    // Reset lastIndex
    const regex = new RegExp(IMPORT_PATTERN.source, 'g');

    while ((match = regex.exec(content)) !== null) {
      const namedImports = match[1];   // { a, b }
      const defaultImport = match[2] || match[5]; // default or type default
      const namespaceImport = match[3];
      const source = match[6];
      const typeNamed = match[4];

      if (!source) continue;

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

  private resolveImports(): void {
    for (const file of this.files.values()) {
      for (const imp of file.imports) {
        const resolved = this.resolveImportPath(file.relativePath, imp.source);
        if (resolved && this.files.has(resolved)) {
          const target = this.files.get(resolved)!;
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
  private resolveImportPath(fromFile: string, importSource: string): string | null {
    // Skip external packages
    if (!importSource.startsWith('.') && !importSource.startsWith('@ai-agent-platform')) {
      return null;
    }

    const fromDir = path.dirname(fromFile);

    if (importSource.startsWith('.')) {
      // Relative import
      let resolved = path.normalize(path.join(fromDir, importSource));

      // Try exact match
      if (this.files.has(resolved)) return resolved;

      // Try with extensions
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.js']) {
        if (this.files.has(resolved + ext)) return resolved + ext;
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
        if (this.files.has(c)) return c;
      }
    }

    return null;
  }
}
