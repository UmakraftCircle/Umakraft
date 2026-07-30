import Database from 'better-sqlite3';
import { createLogger } from '@ai-agent-platform/shared';
import * as path from 'path';

const logger = createLogger('SQLite-Database');

let dbPromise: Promise<Database.Database> | null = null;

/**
 * Returns the better-sqlite3 Database instance, creating it if it doesn't exist.
 * Uses a shared init promise to prevent concurrent callers from opening
 * multiple connections (race condition fix).
 */
export function getDatabase(): Promise<Database.Database> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const dbPath = path.resolve('platform.db');
    logger.info(`Initializing SQLite Database at: ${dbPath}`);

    try {
      const db = new Database(dbPath);

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

      logger.info('Successfully connected to SQLite database.');
      logger.info('SQLite Tables successfully verified (including memory).');
      resolve(db);
    } catch (err: any) {
      logger.error(`Failed to initialize SQLite database: ${err.message}`);
      dbPromise = null; // reset so retry is possible
      reject(err);
    }
  });

  return dbPromise;
}
