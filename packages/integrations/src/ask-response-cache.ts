import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('AskResponseCache');

/**
 * Turso-backed cache for `/ask` web-research answers.
 *
 * Only answers that required a web search (search_web) are cached, keyed by the
 * normalized question string (shared across all users). No TTL: a cached answer
 * is reused whenever the same (normalized) question is asked again.
 *
 * Mirrors the TursoWebSearchCache conventions in web-search.ts.
 */
class AskResponseCache {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ask_response_cache (
        question    TEXT PRIMARY KEY,
        answer      TEXT NOT NULL,
        created_at  TEXT NOT NULL
      )
    `);
    this.tableReady = true;
    logger.info('ask_response_cache table ready');
  }

  /** Return the cached answer for a normalized question, or null if absent. */
  async get(question: string): Promise<string | null> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT answer FROM ask_response_cache WHERE question = ?',
      args: [question],
    });
    if (res.rows.length === 0) return null;
    return res.rows[0]['answer'] as string;
  }

  /** Upsert a cached answer for a normalized question. */
  async set(question: string, answer: string): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO ask_response_cache (question, answer, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(question) DO UPDATE SET
              answer = excluded.answer,
              created_at = excluded.created_at`,
      args: [question, answer, now],
    });
  }
}

export const askResponseCache = new AskResponseCache();
