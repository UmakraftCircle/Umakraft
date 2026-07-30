import sqlite3 from 'sqlite3';
import { createLogger } from '@ai-agent-platform/shared';
import * as path from 'path';

const logger = createLogger('SQLite-Database');

let dbInstance: sqlite3.Database | null = null;

/**
 * Returns the sqlite3.Database instance, creating it if it doesn't exist.
 */
export function getDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const dbPath = path.resolve('platform.db');
    logger.info(`Initializing SQLite Database at: ${dbPath}`);

    // Open connection
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error(`Failed to open SQLite database: ${err.message}`);
        return reject(err);
      }

      logger.info('Successfully connected to SQLite database.');

      // Create persistent schemas for plans and task queues
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS execution_plans (
            id TEXT PRIMARY KEY,
            intent TEXT NOT NULL,
            model_used TEXT NOT NULL,
            created_at TEXT NOT NULL,
            estimated_steps INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
          );
        `, (createPlanErr) => {
          if (createPlanErr) {
            logger.error(`Failed to create execution_plans table: ${createPlanErr.message}`);
            return reject(createPlanErr);
          }
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT NOT NULL,
            plan_id TEXT NOT NULL,
            name TEXT NOT NULL,
            tool_slug TEXT NOT NULL,
            arguments TEXT NOT NULL, -- Stored as JSON string
            dependencies TEXT NOT NULL, -- Stored as JSON array string
            status TEXT NOT NULL,
            result TEXT, -- Stored as JSON string
            error TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 3,
            PRIMARY KEY (id, plan_id),
            FOREIGN KEY (plan_id) REFERENCES execution_plans(id) ON DELETE CASCADE
          );
        `, (createTaskErr) => {
          if (createTaskErr) {
            logger.error(`Failed to create tasks table: ${createTaskErr.message}`);
            return reject(createTaskErr);
          }

          logger.info(`SQLite Tables successfully verified.`);
          dbInstance = db;
          resolve(dbInstance);
        });
      });
    });
  });
}
