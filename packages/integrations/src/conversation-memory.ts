import { getTursoClient, isTursoConfigured } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ConversationMemory');

/** A single stored conversation turn. */
export interface ConversationTurn {
  id: string;
  userId: string;
  channelId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

const MAX_TURNS_PER_SCOPE = 20;

/**
 * Feature 1: lightweight conversation/memory persistence backed by Turso
 * (or in-memory when Turso credentials are not configured).
 * Stores recent turns keyed by (user, channel) so the agent can inject
 * short-term context into every /ask and /chat request. Deliberately stores only
 * plain text and no sensitive material.
 */
export class ConversationMemoryStore {
  private tableReady = false;
  private turnsMap = new Map<string, ConversationTurn[]>();
  private useMemoryFallback = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;

    if (!isTursoConfigured()) {
      this.useMemoryFallback = true;
      this.tableReady = true;
      logger.info('ConversationMemoryStore using in-memory store (no Turso credentials configured)');
      return;
    }

    try {
      const db = getTursoClient();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS conversation_memory (
          id         TEXT PRIMARY KEY,
          user_id    TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          role       TEXT NOT NULL,
          content    TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_conv_scope ON conversation_memory (user_id, channel_id, created_at)'
      );
      this.tableReady = true;
      logger.info('conversation_memory table ready in Turso');
    } catch (err: any) {
      logger.warn(`Turso conversation_memory init failed, falling back to memory: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      this.tableReady = true;
    }
  }

  private makeId(): string {
    return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** Append a turn. */
  async append(turn: Omit<ConversationTurn, 'id' | 'createdAt'>): Promise<void> {
    await this.init();
    const now = new Date().toISOString();
    const key = `${turn.userId}:${turn.channelId}`;
    const item: ConversationTurn = {
      id: this.makeId(),
      userId: turn.userId,
      channelId: turn.channelId,
      role: turn.role,
      content: turn.content,
      createdAt: now,
    };

    const list = this.turnsMap.get(key) || [];
    list.push(item);
    if (list.length > 50) list.shift();
    this.turnsMap.set(key, list);

    if (this.useMemoryFallback) return;

    try {
      const db = getTursoClient();
      await db.execute({
        sql: 'INSERT INTO conversation_memory (id, user_id, channel_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [item.id, turn.userId, turn.channelId, turn.role, turn.content, now],
      });
    } catch (err: any) {
      logger.warn(`Turso append turn failed: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
    }
  }

  /** Return the most recent N turns for a (user, channel) scope, oldest first. */
  async recent(userId: string, channelId: string, limit = MAX_TURNS_PER_SCOPE): Promise<ConversationTurn[]> {
    await this.init();
    const key = `${userId}:${channelId}`;

    if (this.useMemoryFallback) {
      const list = this.turnsMap.get(key) || [];
      return list.slice(-limit);
    }

    try {
      const db = getTursoClient();
      const result = await db.execute({
        sql: `SELECT * FROM (
                SELECT id, user_id, channel_id, role, content, created_at
                FROM conversation_memory
                WHERE user_id = ? AND channel_id = ?
                ORDER BY created_at DESC
                LIMIT ?
              ) ORDER BY created_at ASC`,
        args: [userId, channelId, limit],
      });
      return result.rows.map((row) => ({
        id: row['id'] as string,
        userId: row['user_id'] as string,
        channelId: row['channel_id'] as string,
        role: row['role'] as 'user' | 'assistant',
        content: row['content'] as string,
        createdAt: row['created_at'] as string,
      }));
    } catch (err: any) {
      logger.warn(`Turso recent turns failed: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      const list = this.turnsMap.get(key) || [];
      return list.slice(-limit);
    }
  }
}

export const conversationMemoryStore = new ConversationMemoryStore();
