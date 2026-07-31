import Database from 'better-sqlite3';
/**
 * Returns the better-sqlite3 Database instance, creating it if it doesn't exist.
 * Uses a shared init promise to prevent concurrent callers from opening
 * multiple connections (race condition fix).
 */
export declare function getDatabase(): Promise<Database.Database>;
//# sourceMappingURL=database.d.ts.map