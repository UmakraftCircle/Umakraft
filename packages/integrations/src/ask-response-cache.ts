import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('AskResponseCache');

/**
 * Turso-backed cache for `/ask` web-research and corrected answers.
 *
 * Answers that required a web search or were corrected by an admin are cached,
 * keyed by the normalized question string (shared across all users).
 */
class AskResponseCache {
  private tableReady = false;
  private memoryCache = new Map<string, string>();
  private useMemoryFallback = false;

  private isTursoAvailable(): boolean {
    return Boolean(process.env['TURSO_URL'] && process.env['TURSO_AUTH_TOKEN']);
  }

  private async init(): Promise<void> {
    if (this.tableReady) return;
    if (!this.isTursoAvailable()) {
      this.useMemoryFallback = true;
      this.tableReady = true;
      logger.info('AskResponseCache initialized using in-memory store (no Turso credentials configured)');
      return;
    }

    try {
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
    } catch (err: any) {
      logger.warn(`Turso ask_response_cache init failed, falling back to memory: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      this.tableReady = true;
    }
  }

  /** Return the cached answer for a normalized question, or null if absent. */
  async get(question: string): Promise<string | null> {
    await this.init();
    if (this.useMemoryFallback) {
      return this.memoryCache.get(question) ?? null;
    }

    try {
      const db = getTursoClient();
      const res = await db.execute({
        sql: 'SELECT answer FROM ask_response_cache WHERE question = ?',
        args: [question],
      });
      if (res.rows.length === 0) {
        return this.memoryCache.get(question) ?? null;
      }
      const ans = res.rows[0]['answer'] as string;
      this.memoryCache.set(question, ans);
      return ans;
    } catch (err: any) {
      logger.warn(`AskResponseCache get error, checking memory: ${err?.message ?? err}`);
      return this.memoryCache.get(question) ?? null;
    }
  }

  /** Upsert a cached answer for a normalized question. */
  async set(question: string, answer: string): Promise<void> {
    await this.init();
    this.memoryCache.set(question, answer);

    if (!this.useMemoryFallback) {
      try {
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
      } catch (err: any) {
        logger.warn(`AskResponseCache set warning: ${err?.message ?? err}`);
      }
    }
  }

  /** Delete a cached answer for a normalized question. */
  async delete(question: string): Promise<boolean> {
    await this.init();
    this.memoryCache.delete(question);

    if (!this.useMemoryFallback) {
      try {
        const db = getTursoClient();
        await db.execute({
          sql: 'DELETE FROM ask_response_cache WHERE question = ?',
          args: [question],
        });
        return true;
      } catch (err: any) {
        logger.warn(`AskResponseCache delete error: ${err?.message ?? err}`);
      }
    }
    return true;
  }

  /** Clear the in-memory cache. */
  clearMemory(): void {
    this.memoryCache.clear();
  }
}

export const askResponseCache = new AskResponseCache();

