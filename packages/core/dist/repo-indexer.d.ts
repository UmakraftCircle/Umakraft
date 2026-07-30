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
    exportedBy: string[];
}
export interface ImportEntry {
    source: string;
    symbols: string[];
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
export declare class RepoIndexer {
    private files;
    private symbolIndex;
    private rootPath;
    constructor(rootPath: string);
    /**
     * Walk the entire repo and build the full index.
     * Returns the number of files indexed.
     */
    index(): Promise<number>;
    /**
     * Search for symbols by name (fuzzy partial match).
     */
    searchSymbols(query: string): SymbolEntry[];
    /**
     * Search files by path pattern.
     */
    searchFiles(pattern: string): FileIndex[];
    /**
     * Get the dependency graph for the entire repo or a specific file.
     */
    getDependencyGraph(filePath?: string): DependencyEdge[];
    /**
     * Get all files that import from a specific file.
     */
    getDependents(filePath: string): FileIndex[];
    /**
     * Get a summary of the indexed repository.
     */
    getSummary(): {
        totalFiles: number;
        totalSymbols: number;
        byKind: Record<string, number>;
        byExtension: Record<string, number>;
        topDependencies: Array<{
            file: string;
            count: number;
        }>;
    };
    private walkDirectory;
    private indexFile;
    private extractSymbols;
    private extractImports;
    private resolveImports;
    /**
     * Resolve a TypeScript import path to a relative file path in the repo.
     */
    private resolveImportPath;
}
//# sourceMappingURL=repo-indexer.d.ts.map