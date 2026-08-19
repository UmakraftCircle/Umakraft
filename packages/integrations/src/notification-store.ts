import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('NotificationStore');

/**
 * Feature 5.7: durable notification dedup. Before notifying a user, the agent
 * computes a contentFingerprint and checks here; if already sent, it skips.
 */
export class NotificationStore {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        fingerprint TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        channel_id  TEXT,
        summary     TEXT NOT NULL,
        sent_at     TEXT NOT NULL
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, sent_at)');
    this.tableReady = true;
    logger.info('notifications table ready');
  }

  /** Returns true if already notified (skip); false otherwise (and records it). */
  async alreadyNotified(fingerprint: string, userId: string): Promise<boolean> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT fingerprint FROM notifications WHERE fingerprint = ? AND user_id = ?',
      args: [fingerprint, userId],
    });
    return res.rows.length > 0;
  }

  async record(fingerprint: string, userId: string, channelId: string | null, summary: string): Promise<void> {
    await this.init();
    const db = getTursoClient();
    await db.execute({
      sql: `INSERT INTO notifications (fingerprint, user_id, channel_id, summary, sent_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(fingerprint) DO NOTHING`,
      args: [fingerprint, userId, channelId ?? '', summary, new Date().toISOString()],
    });
  }

  async recordIfNew(fingerprint: string, userId: string, channelId: string | null, summary: string): Promise<boolean> {
    await this.init();
    const already = await this.alreadyNotified(fingerprint, userId);
    if (already) return false;
    await this.record(fingerprint, userId, channelId, summary);
    return true;
  }
}

export const notificationStore = new NotificationStore();
