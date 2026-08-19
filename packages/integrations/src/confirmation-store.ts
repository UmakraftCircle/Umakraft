import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';
import type { Confirmation } from './automation.js';
import { DEFAULT_CONFIRMATION_TTL_MS } from './automation.js';

const logger = createLogger('ConfirmationStore');

/**
 * Feature 5.5: single-use, user-bound, expiring confirmation tokens.
 * A high-risk action is registered here and only executes after the
 * designated user approves it (via a Discord button).
 */
export class ConfirmationStore {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS confirmations (
        id            TEXT PRIMARY KEY,
        action_slug   TEXT NOT NULL,
        action_summary TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        channel_id    TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        expires_at    TEXT NOT NULL,
        consumed      INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.tableReady = true;
    logger.info('confirmations table ready');
  }

  private makeId(): string {
    return `cfm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async create(entry: { actionSlug: string; actionSummary: string; userId: string; channelId: string; ttlMs?: number }): Promise<Confirmation> {
    await this.init();
    const db = getTursoClient();
    const now = new Date();
    const ttl = entry.ttlMs ?? DEFAULT_CONFIRMATION_TTL_MS;
    const conf: Confirmation = {
      id: this.makeId(),
      actionSlug: entry.actionSlug,
      actionSummary: entry.actionSummary,
      userId: entry.userId,
      channelId: entry.channelId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
      consumed: 0,
    };
    await db.execute({
      sql: `INSERT INTO confirmations (id, action_slug, action_summary, user_id, channel_id, created_at, expires_at, consumed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [conf.id, conf.actionSlug, conf.actionSummary, conf.userId, conf.channelId, conf.createdAt, conf.expiresAt, 0],
    });
    return conf;
  }

  async get(id: string): Promise<Confirmation | null> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({ sql: 'SELECT * FROM confirmations WHERE id = ?', args: [id] });
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  /**
   * Try to consume the confirmation for `userId`. Returns
   *  - { ok: true } on success
   *  - { ok: false, reason } on failure (not found / wrong user / expired / used)
   * Single-use: consuming sets `consumed = 1` and prevents re-use.
   */
  async consume(id: string, userId: string): Promise<{ ok: boolean; reason?: string }> {
    await this.init();
    const db = getTursoClient();
    const conf = await this.get(id);
    if (!conf) return { ok: false, reason: 'not-found' };
    if (conf.userId !== userId) return { ok: false, reason: 'wrong-user' };
    if (conf.consumed !== 0) return { ok: false, reason: 'already-used' };
    if (new Date(conf.expiresAt).getTime() <= Date.now()) return { ok: false, reason: 'expired' };

    await db.execute({
      sql: 'UPDATE confirmations SET consumed = 1 WHERE id = ? AND consumed = 0',
      args: [id],
    });
    return { ok: true };
  }

  private mapRow(row: any): Confirmation {
    return {
      id: row['id'] as string,
      actionSlug: row['action_slug'] as string,
      actionSummary: row['action_summary'] as string,
      userId: row['user_id'] as string,
      channelId: row['channel_id'] as string,
      createdAt: row['created_at'] as string,
      expiresAt: row['expires_at'] as string,
      consumed: Number(row['consumed']),
    };
  }
}

export const confirmationStore = new ConfirmationStore();
