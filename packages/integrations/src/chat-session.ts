import { getTursoClient, isTursoConfigured } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ChatSession');

/**
 * Tracks the "current active `/chat` session" per Discord user, persisted in
 * Turso (or in memory if Turso is not configured) so it survives across messages.
 *
 * Lifecycle (per the `/chat` spec):
 *   - `Speak` opens/resets a session — a new `Speak` OVERWRITES the previous one.
 *   - `Reply` continues the current session, and is REJECTED when no session exists.
 */

export interface ChatSession {
  userId: string;
  conversationId: string;
  channelId: string;
  startedAt: string;
  lastActiveAt: string;
  turnCount: number;
}

export class ChatSessionStore {
  private tableReady = false;
  private memoryStore = new Map<string, ChatSession>();
  private useMemoryFallback = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;

    if (!isTursoConfigured()) {
      this.useMemoryFallback = true;
      this.tableReady = true;
      logger.info('ChatSessionStore using in-memory store (no Turso credentials configured)');
      return;
    }

    try {
      const db = getTursoClient();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          user_id         TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          channel_id      TEXT NOT NULL,
          started_at      TEXT NOT NULL,
          last_active_at  TEXT NOT NULL,
          turn_count      INTEGER NOT NULL DEFAULT 0
        )
      `);
      this.tableReady = true;
      logger.info('chat_sessions table ready in Turso');
    } catch (err: any) {
      logger.warn(`Turso chat_sessions init failed, falling back to memory: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      this.tableReady = true;
    }
  }

  private makeConversationId(userId: string): string {
    return `conv-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Open or reset a session for a user (Speak). Always overwrites. */
  async openSession(userId: string, channelId: string): Promise<ChatSession> {
    await this.init();
    const now = new Date().toISOString();
    const conversationId = this.makeConversationId(userId);
    const session: ChatSession = {
      userId,
      conversationId,
      channelId,
      startedAt: now,
      lastActiveAt: now,
      turnCount: 1,
    };

    if (this.useMemoryFallback) {
      this.memoryStore.set(userId, session);
      logger.info(`Opened (or reset) in-memory chat session for ${userId} → ${conversationId}`);
      return session;
    }

    try {
      const db = getTursoClient();
      await db.execute({
        sql: `INSERT INTO chat_sessions (user_id, conversation_id, channel_id, started_at, last_active_at, turn_count)
              VALUES (?, ?, ?, ?, ?, 1)
              ON CONFLICT(user_id) DO UPDATE SET
                conversation_id = excluded.conversation_id,
                channel_id      = excluded.channel_id,
                started_at      = excluded.started_at,
                last_active_at  = excluded.last_active_at,
                turn_count      = 1`,
        args: [userId, conversationId, channelId, now, now],
      });
      this.memoryStore.set(userId, session);
      logger.info(`Opened (or reset) chat session for ${userId} → ${conversationId}`);
      return session;
    } catch (err: any) {
      logger.warn(`Turso openSession failed, using memory fallback: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      this.memoryStore.set(userId, session);
      return session;
    }
  }

  /** Get the current active session, or null if none (Reply should be rejected). */
  async getSession(userId: string): Promise<ChatSession | null> {
    await this.init();
    if (this.useMemoryFallback) {
      return this.memoryStore.get(userId) ?? null;
    }

    try {
      const db = getTursoClient();
      const res = await db.execute({
        sql: 'SELECT * FROM chat_sessions WHERE user_id = ?',
        args: [userId],
      });
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const session: ChatSession = {
        userId,
        conversationId: row['conversation_id'] as string,
        channelId: row['channel_id'] as string,
        startedAt: row['started_at'] as string,
        lastActiveAt: row['last_active_at'] as string,
        turnCount: Number(row['turn_count'] ?? 0),
      };
      this.memoryStore.set(userId, session);
      return session;
    } catch (err: any) {
      logger.warn(`Turso getSession failed, using memory fallback: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      return this.memoryStore.get(userId) ?? null;
    }
  }

  /** Advance the current session's turn counter + last-active timestamp (Reply). */
  async bumpTurn(userId: string): Promise<void> {
    await this.init();
    const now = new Date().toISOString();
    const existing = this.memoryStore.get(userId);
    if (existing) {
      existing.turnCount += 1;
      existing.lastActiveAt = now;
    }

    if (this.useMemoryFallback) {
      return;
    }

    try {
      const db = getTursoClient();
      await db.execute({
        sql: `UPDATE chat_sessions SET turn_count = turn_count + 1, last_active_at = ? WHERE user_id = ?`,
        args: [now, userId],
      });
    } catch (err: any) {
      logger.warn(`Turso bumpTurn failed: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
    }
  }
}

export const chatSessionStore = new ChatSessionStore();
