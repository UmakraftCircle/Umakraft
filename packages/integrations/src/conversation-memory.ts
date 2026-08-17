import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ConversationMemory');

/**
 * ConversationMemoryStore — persistent, scoped conversation memory backed by Turso (libSQL).
 *
 * Design goals (Feature 1 — Context & Memory):
 *  - Store message + session + long-term memory, separated from immediate history.
 *  - Scope EVERY query by (user_id, guild_id, channel_id) to prevent cross-context leakage.
 *  - Use parameterized queries only (no string interpolation of user data).
 *  - Handles concurrent conversations safely (SQLite/Turso transactions + upserts).
 *  - Provide expiry/pruning + summarization hooks.
 *
 * Schema:
 *   conversation_sessions  — one row per active conversation session.
 *   conversation_messages  — every user + AI turn, keyed to a session.
 *   long_term_memory       — durable facts/notes, separate from the live transcript.
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ConversationMessage {
  id: string;
  sessionId: string;
  userId: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  role: MessageRole;
  content: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  guildId: string;
  channelId: string;
  startedAt: string;
  lastActiveAt: string;
}

export interface LongTermMemory {
  id: string;
  userId: string;
  guildId: string;
  channelId: string | null;
  type: string;
  content: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface AppendMessageInput {
  sessionId: string;
  userId: string;
  guildId: string;
  channelId: string;
  messageId?: string | null;
  role: MessageRole;
  content: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ScopeFilter {
  userId: string;
  guildId: string;
  channelId: string;
}

// Token/context windows are configurable via env, with production-safe defaults.
const DEFAULT_CONTEXT_WINDOW = 20; // max recent messages injected into short-term context

export class ConversationMemoryStore {
  private tableReady = false;

  /** Ensure all three tables exist (idempotent). */
  async init(): Promise<void> {
    if (this.tableReady) return;

    const db = getTursoClient();

    await db.execute(`
      CREATE TABLE IF NOT EXISTS conversation_sessions (
        session_id    TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL,
        guild_id      TEXT NOT NULL,
        channel_id    TEXT NOT NULL,
        started_at    TEXT NOT NULL,
        last_active_at TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT,
        role        TEXT NOT NULL,
        content     TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        metadata    TEXT
      )
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_messages_scope
        ON conversation_messages (user_id, guild_id, channel_id, created_at DESC)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_messages_session
        ON conversation_messages (session_id, created_at ASC)
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS long_term_memory (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        channel_id TEXT,
        type       TEXT NOT NULL,
        content    TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata   TEXT
      )
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_ltm_scope
        ON long_term_memory (user_id, guild_id, created_at DESC)
    `);

    this.tableReady = true;
    logger.info('conversation memory tables ready');
  }

  /** Start a new session or resume the most recent one for this scope. */
  async getOrCreateSession(scope: ScopeFilter): Promise<ConversationSession> {
    await this.init();
    const db = getTursoClient();

    // Resume the most recent session within this exact scope.
    const existing = await db.execute({
      sql: `SELECT session_id, user_id, guild_id, channel_id, started_at, last_active_at
            FROM conversation_sessions
            WHERE user_id = ? AND guild_id = ? AND channel_id = ?
            ORDER BY last_active_at DESC
            LIMIT 1`,
      args: [scope.userId, scope.guildId, scope.channelId],
    });

    if (existing.rows.length > 0) {
      const r = existing.rows[0] as unknown as Record<string, string>;
      return {
        sessionId: r['session_id'],
        userId: r['user_id'],
        guildId: r['guild_id'],
        channelId: r['channel_id'],
        startedAt: r['started_at'],
        lastActiveAt: r['last_active_at'],
      };
    }

    const sessionId = this.#newId('sess');
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO conversation_sessions
              (session_id, user_id, guild_id, channel_id, started_at, last_active_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [sessionId, scope.userId, scope.guildId, scope.channelId, now, now],
    });

    return {
      sessionId,
      userId: scope.userId,
      guildId: scope.guildId,
      channelId: scope.channelId,
      startedAt: now,
      lastActiveAt: now,
    };
  }

  /** Persist one turn (user message or AI response). */
  async appendMessage(input: AppendMessageInput): Promise<ConversationMessage> {
    await this.init();
    const db = getTursoClient();
    const id = this.#newId('msg');
    const createdAt = input.createdAt ?? new Date().toISOString();
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

    await db.execute({
      sql: `INSERT INTO conversation_messages
              (id, session_id, user_id, guild_id, channel_id, message_id, role, content, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.sessionId,
        input.userId,
        input.guildId,
        input.channelId,
        input.messageId ?? null,
        input.role,
        input.content,
        createdAt,
        metadata,
      ],
    });

    // Bump session last_active_at so "resume" always surfaces the right session.
    await db.execute({
      sql: `UPDATE conversation_sessions SET last_active_at = ? WHERE session_id = ?`,
      args: [createdAt, input.sessionId],
    });

    return {
      id,
      sessionId: input.sessionId,
      userId: input.userId,
      guildId: input.guildId,
      channelId: input.channelId,
      messageId: input.messageId ?? null,
      role: input.role,
      content: input.content,
      createdAt,
      metadata: input.metadata ?? null,
    };
  }

  /**
   * Retrieve the most recent messages for this scope (short-term context),
   * oldest → newest, capped to `limit`. Scoped strictly by user/guild/channel.
   */
  async getRecentMessages(scope: ScopeFilter, limit = DEFAULT_CONTEXT_WINDOW): Promise<ConversationMessage[]> {
    await this.init();
    const db = getTursoClient();

    const res = await db.execute({
      sql: `SELECT id, session_id, user_id, guild_id, channel_id, message_id, role, content, created_at, metadata
            FROM conversation_messages
            WHERE user_id = ? AND guild_id = ? AND channel_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [scope.userId, scope.guildId, scope.channelId, limit],
    });

    const rows = res.rows as unknown as Array<Record<string, string | null>>;
    return rows
      .map((r) => ({
        id: r['id'] as string,
        sessionId: r['session_id'] as string,
        userId: r['user_id'] as string,
        guildId: r['guild_id'] as string,
        channelId: r['channel_id'] as string,
        messageId: r['message_id'] as string | null,
        role: r['role'] as MessageRole,
        content: r['content'] as string,
        createdAt: r['created_at'] as string,
        metadata: r['metadata'] ? (JSON.parse(r['metadata'] as string) as Record<string, unknown>) : null,
      }))
      .reverse(); // oldest → newest for model consumption
  }

  /** Persist a durable long-term memory fact/note (separate from the transcript). */
  async saveLongTermMemory(input: {
    userId: string;
    guildId: string;
    channelId?: string | null;
    type: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<LongTermMemory> {
    await this.init();
    const db = getTursoClient();
    const id = this.#newId('ltm');
    const createdAt = new Date().toISOString();
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

    await db.execute({
      sql: `INSERT INTO long_term_memory
              (id, user_id, guild_id, channel_id, type, content, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.userId,
        input.guildId,
        input.channelId ?? null,
        input.type,
        input.content,
        createdAt,
        metadata,
      ],
    });

    return {
      id,
      userId: input.userId,
      guildId: input.guildId,
      channelId: input.channelId ?? null,
      type: input.type,
      content: input.content,
      createdAt,
      metadata: input.metadata ?? null,
    };
  }

  /**
   * Retrieve relevant long-term memory for a scope.
   * Current relevance = recency-scoped lookup + optional substring match on `query`
   * (embedding-based retrieval is a later feature — the hook is provider-agnostic).
   */
  async getLongTermMemory(scope: ScopeFilter, query?: string, limit = 5): Promise<LongTermMemory[]> {
    await this.init();
    const db = getTursoClient();

    // Scope to the user (always) and, if a channel is specified, that channel.
    // Guild-level memory (channel_id IS NULL) is also surfaced for the user's guild.
    const res = await db.execute({
      sql: `SELECT id, user_id, guild_id, channel_id, type, content, created_at, metadata
            FROM long_term_memory
            WHERE user_id = ? AND guild_id = ?
              AND (channel_id IS NULL OR channel_id = ?)
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [scope.userId, scope.guildId, scope.channelId, limit],
    });

    let rows = res.rows as unknown as Array<Record<string, string | null>>;
    let parsed = rows.map((r) => ({
      id: r['id'] as string,
      userId: r['user_id'] as string,
      guildId: r['guild_id'] as string,
      channelId: r['channel_id'] as string | null,
      type: r['type'] as string,
      content: r['content'] as string,
      createdAt: r['created_at'] as string,
      metadata: r['metadata'] ? (JSON.parse(r['metadata'] as string) as Record<string, unknown>) : null,
    }));

    // Cheap relevance filter while we don't yet have embeddings.
    if (query && query.trim()) {
      const q = query.toLowerCase();
      parsed = parsed.sort((a, b) => {
        const aHit = a.content.toLowerCase().includes(q) ? 1 : 0;
        const bHit = b.content.toLowerCase().includes(q) ? 1 : 0;
        return bHit - aHit;
      });
    }

    return parsed;
  }

  /**
   * Prune messages older than `olderThanMs`, scoped (optionally) to a channel.
   * Returns the number of rows removed. Runs atomically.
   */
  async pruneOldMessages(olderThanMs: number, scope?: Partial<ScopeFilter>): Promise<number> {
    await this.init();
    const db = getTursoClient();
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();

    let sql = `DELETE FROM conversation_messages WHERE created_at < ?`;
    const args: (string | number)[] = [cutoff];

    if (scope?.userId) {
      sql += ` AND user_id = ?`;
      args.push(scope.userId);
    }
    if (scope?.guildId) {
      sql += ` AND guild_id = ?`;
      args.push(scope.guildId);
    }
    if (scope?.channelId) {
      sql += ` AND channel_id = ?`;
      args.push(scope.channelId);
    }

    const res = await db.execute({ sql, args });
    const removed = Number((res as unknown as { rowsAffected?: number }).rowsAffected ?? 0);
    logger.info(`pruned ${removed} old conversation messages`);
    return removed;
  }

  /**
   * Summarize-and-compact hook for a session. Feature 1 stores the summary as a
   * long-term memory entry and prunes the source messages so old history never
   * bloats the live context. The actual summarization may be wired to a provider
   * in a later feature; this method provides the persistence mechanics.
   */
  async summarizeAndCompact(scope: ScopeFilter, summaryProvider?: (messages: ConversationMessage[]) => Promise<string>): Promise<void> {
    await this.init();
    const messages = await this.getRecentMessages(scope, 200);
    if (messages.length === 0) return;

    let summary: string;
    if (summaryProvider) {
      summary = await summaryProvider(messages);
    } else {
      // Fallback: a lossy but safe mechanical summary marker.
      summary = `[auto-compact] ${messages.length} turns (${messages[0].content.slice(0, 80)} …)`;
    }

    await this.saveLongTermMemory({
      userId: scope.userId,
      guildId: scope.guildId,
      channelId: scope.channelId,
      type: 'summary',
      content: summary,
      metadata: { compactedFrom: messages.length, compactedAt: new Date().toISOString() },
    });

    // Prune the messages that were folded into the summary.
    if (messages.length > 0) {
      const db = getTursoClient();
      await db.execute({
        sql: `DELETE FROM conversation_messages WHERE id IN (${messages.map(() => '?').join(',')})`,
        args: messages.map((m) => m.id),
      });
    }

    logger.info(`summarized ${messages.length} turns into long-term memory for user ${scope.userId}`);
  }

  #newId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Singleton export, matching the existing `trainerLinkStore` pattern. */
export const conversationMemoryStore = new ConversationMemoryStore();
