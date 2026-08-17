import { getTursoClient } from './turso.js';
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
 * Feature 1: lightweight conversation/memory persistence backed by Turso.
 * Stores recent turns keyed by (user, channel) so the agent can inject
 * short-term context into every /ask request. Deliberately stores only
 * plain text and no sensitive material.
 */
export class ConversationMemoryStore {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
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
    logger.info('conversation_memory table ready');
  }

  private makeId(): string {
    return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** Append a turn. */
  async append(turn: Omit<ConversationTurn, 'id' | 'createdAt'>): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const now = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO conversation_memory (id, user_id, channel_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [this.makeId(), turn.userId, turn.channelId, turn.role, turn.content, now],
    });
  }

  /** Return the most recent N turns for a (user, channel) scope, oldest first. */
  async recent(userId: string, channelId: string, limit = MAX_TURNS_PER_SCOPE): Promise<ConversationTurn[]> {
    await this.init();
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
  }
}

export const conversationMemoryStore = new ConversationMemoryStore();
