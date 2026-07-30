import Database from 'better-sqlite3';
/**
 * Returns the better-sqlite3 Database instance, creating it if it doesn't exist.
 * better-sqlite3 is synchronous; this returns a Promise to keep the same public interface.
 */
export declare function getDatabase(): Promise<Database.Database>;
//# sourceMappingURL=database.d.ts.map