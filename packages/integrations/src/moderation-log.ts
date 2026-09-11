import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ModerationLog');

/**
 * Turso-backed log of off-topic `/ask` questions, for admin review.
 *
 * Improper/content-violating questions are NEVER logged (see Layer 1 in guard.ts).
 * Only off-topic (but harmless) questions + requester identity metadata are stored
 * so admins can see what scope the bot is being asked beyond its domain.
 */
class ModerationLogStore {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ask_moderation_log (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        question    TEXT NOT NULL,
        created_at  TEXT NOT NULL
      )
    `);
    this.tableReady = true;
    logger.info('ask_moderation_log table ready');
  }

  private makeId(): string {
    return `mod-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** Append an off-topic question (trimmed, content capped to 500 chars). */
  async append(userId: string, channelId: string, question: string): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const safe = question.slice(0, 500);
    await db.execute({
      sql: 'INSERT INTO ask_moderation_log (id, user_id, channel_id, question, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [this.makeId(), userId, channelId, safe, new Date().toISOString()],
    });
    logger.info('Logged off-topic question for admin review');
  }

  /** Return the most recent N off-topic entries, newest first. */
  async recent(limit = 50): Promise<Array<{ userId: string; channelId: string; question: string; createdAt: string }>> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT user_id, channel_id, question, created_at FROM ask_moderation_log ORDER BY created_at DESC LIMIT ?',
      args: [limit],
    });
    return res.rows.map((row: any) => ({
      userId: row['user_id'] as string,
      channelId: row['channel_id'] as string,
      question: row['question'] as string,
      createdAt: row['created_at'] as string,
    }));
  }
}

export const moderationLogStore = new ModerationLogStore();
