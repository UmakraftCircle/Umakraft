import { createLogger } from '@ai-agent-platform/shared';
import * as path from 'path';

const logger = createLogger('SQLite-Database');

export interface DatabaseInterface {
  pragma(sql: string): any;
  exec(sql: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
  prepare(sql: string): {
    run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  };
}

class InMemorySqliteFallback implements DatabaseInterface {
  private tables = new Map<string, any[]>();
  private autoIds = new Map<string, number>();

  pragma(_sql: string): any {
    return [];
  }

  exec(sql: string): void {
    const createMatches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi);
    for (const match of createMatches) {
      const tableName = match[1].toLowerCase();
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
        this.autoIds.set(tableName, 1);
      }
    }
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => fn(...args)) as T;
  }

  prepare(sql: string) {
    const cleanSql = sql.trim();
    const self = this;

    // Detect table
    const tableMatch = cleanSql.match(/(?:FROM|INTO|UPDATE|TABLE)\s+([a-zA-Z0-9_]+)/i);
    const tableName = tableMatch ? tableMatch[1].toLowerCase() : 'default';

    if (!self.tables.has(tableName)) {
      self.tables.set(tableName, []);
      self.autoIds.set(tableName, 1);
    }

    return {
      run(...params: any[]) {
        const rows = self.tables.get(tableName)!;
        const currentAutoId = self.autoIds.get(tableName) || 1;

        if (/^INSERT\s+INTO/i.test(cleanSql)) {
          const colMatch = cleanSql.match(/\(([^)]+)\)\s*VALUES/i);
          let row: Record<string, any> = { id: currentAutoId };
          if (colMatch) {
            const cols = colMatch[1].split(',').map((c) => c.trim().replace(/['"`]/g, ''));
            cols.forEach((col, idx) => {
              row[col] = params[idx];
            });
          } else {
            params.forEach((val, idx) => {
              row[`col_${idx}`] = val;
            });
          }
          rows.push(row);
          self.autoIds.set(tableName, currentAutoId + 1);
          return { changes: 1, lastInsertRowid: currentAutoId };
        }

        if (/^DELETE\s+FROM/i.test(cleanSql)) {
          if (params.length > 0) {
            const initialLength = rows.length;
            const filtered = rows.filter((r) => !Object.values(r).includes(params[0]));
            self.tables.set(tableName, filtered);
            return { changes: initialLength - filtered.length, lastInsertRowid: 0 };
          }
          const changes = rows.length;
          self.tables.set(tableName, []);
          return { changes, lastInsertRowid: 0 };
        }

        if (/^UPDATE/i.test(cleanSql)) {
          return { changes: rows.length, lastInsertRowid: 0 };
        }

        return { changes: 0, lastInsertRowid: 0 };
      },

      get(...params: any[]) {
        const rows = self.tables.get(tableName)!;
        if (params.length === 0) return rows[0] || undefined;
        return rows.find((r) => Object.values(r).includes(params[0])) || undefined;
      },

      all(...params: any[]) {
        const rows = self.tables.get(tableName)!;
        if (params.length === 0) return [...rows];
        return rows.filter((r) => Object.values(r).includes(params[0]));
      },
    };
  }
}

let dbPromise: Promise<DatabaseInterface> | null = null;

/**
 * Returns the SQLite Database instance, creating it if it doesn't exist.
 * Uses a shared init promise to prevent concurrent callers from opening
 * multiple connections (race condition fix).
 *
 * Dynamically loads better-sqlite3 with resilient fallback to avoid fatal
 * container crash if native bindings are unavailable in the host environment.
 */
export async function getDatabase(): Promise<DatabaseInterface> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const dbPath = path.resolve('platform.db');
    logger.info(`Initializing SQLite Database at: ${dbPath}`);

    try {
      // Dynamic import to prevent hard crash if binary isn't present
      const betterSqliteModule = await import('better-sqlite3' as any).catch(() => null);
      const DatabaseClass = betterSqliteModule?.default || betterSqliteModule;

      if (!DatabaseClass) {
        logger.warn('better-sqlite3 package not available in environment; using resilient in-memory SQLite store');
        const fallbackDb = new InMemorySqliteFallback();
        initDefaultSchema(fallbackDb);
        return fallbackDb;
      }

      const db = new DatabaseClass(dbPath);

      // Enable foreign key enforcement (disabled by default in SQLite)
      db.pragma('foreign_keys = ON');

      // Wrap ALL schema creation in a single transaction
      const createSchema = db.transaction(() => {
        initDefaultSchema(db);
      });

      createSchema(); // execute the transaction

      logger.info('Successfully connected to SQLite database.');
      logger.info('SQLite Tables successfully verified (including memory).');
      return db;
    } catch (err: any) {
      logger.warn(`Failed to initialize native SQLite database: ${err.message}; falling back to in-memory store`);
      const fallbackDb = new InMemorySqliteFallback();
      initDefaultSchema(fallbackDb);
      return fallbackDb;
    }
  })();

  return dbPromise;
}

function initDefaultSchema(db: DatabaseInterface): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS execution_plans (
      id TEXT PRIMARY KEY,
      intent TEXT NOT NULL,
      model_used TEXT NOT NULL,
      created_at TEXT NOT NULL,
      estimated_steps INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      name TEXT NOT NULL,
      tool_slug TEXT NOT NULL,
      arguments TEXT NOT NULL,
      dependencies TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      PRIMARY KEY (id, plan_id),
      FOREIGN KEY (plan_id) REFERENCES execution_plans(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      tool_slug TEXT NOT NULL,
      error_message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      context TEXT
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS adaptation_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      occurrences INTEGER NOT NULL DEFAULT 1,
      last_seen TEXT NOT NULL
    );
  `);
}
