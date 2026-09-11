import { getTursoClient, isTursoConfigured } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ConversationMemory');

/** Standard chat message structure for conversational agents. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

/** A single stored conversation turn with database metadata. */
export interface ConversationTurn {
  id: string;
  userId: string;
  channelId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export const MAX_MESSAGES = 20;
const MAX_TURNS_PER_SCOPE = 20;

/**
 * Conversation & Memory Context Store.
 * Provides:
 *  1. Isolated in-memory DM conversation history keyed by Discord User ID (message.author.id).
 *  2. Sliding window history limit (MAX_MESSAGES = 20) to prevent unlimited memory growth.
 *  3. Durable Turso persistence (or in-memory fallback) across Discord DM/channel sessions.
 */
export class ConversationMemoryStore {
  private tableReady = false;
  private turnsMap = new Map<string, ConversationTurn[]>();
  /** Dedicated conversation store keyed by Discord user ID: Map<string, ChatMessage[]> */
  private conversations = new Map<string, ChatMessage[]>();
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

  /**
   * Returns the conversation history for a given user.
   * Guarantees strict user isolation: User A -> Memory A, User B -> Memory B.
   */
  getConversation(userId: string): ChatMessage[] {
    const key = userId.replace(/^discord:/i, '');
    const history = this.conversations.get(key) || [];
    return [...history];
  }

  /**
   * Appends a chat message to the user's isolated conversation store
   * and enforces the MAX_MESSAGES sliding window limit.
   */
  addMessage(userId: string, role: 'user' | 'assistant', content: string): ChatMessage[] {
    const key = userId.replace(/^discord:/i, '');
    const history = this.conversations.get(key) || [];
    history.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // History limit: prevent unlimited growth
    if (history.length > MAX_MESSAGES) {
      history.splice(0, history.length - MAX_MESSAGES);
    }

    this.conversations.set(key, history);
    return [...history];
  }

  /**
   * Clears conversation history for a user, or all users if no userId is specified.
   */
  clear(userId?: string): void {
    if (userId) {
      const key = userId.replace(/^discord:/i, '');
      this.conversations.delete(key);
      for (const mapKey of Array.from(this.turnsMap.keys())) {
        if (mapKey.startsWith(`${userId}:`) || mapKey.startsWith(`discord:${userId}:`)) {
          this.turnsMap.delete(mapKey);
        }
      }
    } else {
      this.conversations.clear();
      this.turnsMap.clear();
    }
  }

  /**
   * Formats chat messages into a context string suitable for LLM injection.
   */
  formatContext(messages: ChatMessage[]): string {
    if (!messages || messages.length === 0) return '';
    return messages
      .map((m) => `${m.role === 'user' ? 'Trainer' : 'Assistant'}: ${m.content}`)
      .join('\n');
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

    // Also sync to isolated user conversation store
    this.addMessage(turn.userId, turn.role, turn.content);

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

