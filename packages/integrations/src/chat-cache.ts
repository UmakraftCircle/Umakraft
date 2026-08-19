import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';
import { cosineSimilarity, type EmbeddingGenerator } from '@ai-agent-platform/ai';

const logger = createLogger('ChatCache');

/**
 * Per-user caching for the `/chat` command, with two responsibilities:
 *
 *   1. Recent-question rolling buffer — stores the latest N questions per user
 *      (configurable via CHAT_RECENT_QUESTIONS_LIMIT, default 50). Enforced at
 *      the DB layer: adding beyond N evicts the oldest raw questions.
 *
 *   2. Long-term digest — a compact summary of recurring topics/interests,
 *      regenerated lazily (when the recent-question buffer overflows) by folding
 *      evicted questions into a new summary. A manual/forced refresh is exposed
 *      for maintenance/testing.
 *
 *   3. Semantic answer cache — per-user, never-expiring answers keyed by an
 *      embedding vector. A "similar question" reuses a cached answer via cosine
 *      similarity (top-K, configurable via CHAT_TOP_K, default 3). The embedding
 *      is produced by the provided EmbeddingGenerator (local MiniLM by default),
 *      injected so this module never hard-codes a model and stays unit-testable.
 */

const DEFAULT_RECENT_QUESTIONS_LIMIT = 50;
const DEFAULT_TOP_K = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.82;

/** A single recent raw question record. */
export interface RecentQuestion {
  id: string;
  userId: string;
  question: string;
  conversationId: string;
  createdAt: string;
}

export interface CachedAnswer {
  id: string;
  userId: string;
  question: string;
  answer: string;
  score: number; // cosine similarity vs the query
  createdAt: string;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export class ChatCacheStore {
  private tableReady = false;

  constructor(private readonly embedder: EmbeddingGenerator) {}

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();

    // ── recent raw questions (rolling buffer) ──
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_recent_questions (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        question        TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        created_at      TEXT NOT NULL
      )
    `);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_chat_q_user ON chat_recent_questions (user_id, created_at)'
    );

    // ── long-term digest (one per user) ──
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_digest (
        user_id     TEXT PRIMARY KEY,
        digest      TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )
    `);

    // ── semantic answer cache (per-user, never expires) ──
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_answer_cache (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        question    TEXT NOT NULL,
        answer      TEXT NOT NULL,
        embedding   TEXT NOT NULL,
        created_at  TEXT NOT NULL
      )
    `);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_chat_cache_user ON chat_answer_cache (user_id)'
    );

    this.tableReady = true;
    logger.info('chat cache tables ready (recent_questions, digest, answer_cache)');
  }

  private makeId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private getRecentLimit(): number {
    return envInt('CHAT_RECENT_QUESTIONS_LIMIT', DEFAULT_RECENT_QUESTIONS_LIMIT);
  }

  private getTopK(): number {
    return envInt('CHAT_TOP_K', DEFAULT_TOP_K);
  }

  // ──────────────────────────────────────────────────────────────
  // Recent questions + digest lifecycle
  // ──────────────────────────────────────────────────────────────

  /**
   * Append a question to the per-user rolling buffer. If the buffer overflows
   * the configurable limit, the oldest questions are evicted and folded into the
   * long-term digest (lazy refresh).
   *
   * `summarize` is injected so this store stays free of LLM/providers and can be
   * unit-tested with a deterministic summarizer.
   */
  async recordQuestion(
    userId: string,
    question: string,
    conversationId: string,
    summarize: (questions: string[], previousDigest: string | null) => Promise<string>,
  ): Promise<{ recorded: boolean }> {
    await this.init();
    const db = getTursoClient();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO chat_recent_questions (id, user_id, question, conversation_id, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [this.makeId('q'), userId, question, conversationId, now],
    });

    const limit = this.getRecentLimit();
    const countRes = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM chat_recent_questions WHERE user_id = ?',
      args: [userId],
    });
    const count = Number(countRes.rows[0]?.['c'] ?? 0);

    if (count > limit) {
      await this.refreshDigest(userId, summarize);
    }

    return { recorded: true };
  }

  /** Get the current recent questions (newest first). */
  async recentQuestions(userId: string, limit?: number): Promise<RecentQuestion[]> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: `SELECT id, user_id, question, conversation_id, created_at
            FROM chat_recent_questions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [userId, limit ?? this.getRecentLimit()],
    });
    return res.rows.map((row) => ({
      id: row['id'] as string,
      userId: row['user_id'] as string,
      question: row['question'] as string,
      conversationId: row['conversation_id'] as string,
      createdAt: row['created_at'] as string,
    }));
  }

  async getDigest(userId: string): Promise<{ digest: string; updatedAt: string } | null> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT digest, updated_at FROM chat_digest WHERE user_id = ?',
      args: [userId],
    });
    if (res.rows.length === 0) return null;
    return {
      digest: res.rows[0]['digest'] as string,
      updatedAt: res.rows[0]['updated_at'] as string,
    };
  }

  /**
   * Lazy digest refresh: evict excess recent questions beyond the limit, fold the
   * evicted questions into a summary, and persist the new digest. Idempotent —
   * safe to call before every query (it only does work when the buffer overflows).
   */
  async refreshDigest(
    userId: string,
    summarize: (questions: string[], previousDigest: string | null) => Promise<string>,
  ): Promise<boolean> {
    await this.init();
    const db = getTursoClient();
    const limit = this.getRecentLimit();

    const allRes = await db.execute({
      sql: `SELECT id, question FROM chat_recent_questions
            WHERE user_id = ?
            ORDER BY created_at DESC`,
      args: [userId],
    });

    if (allRes.rows.length <= limit) {
      // Not enough questions to trigger a refresh — nothing to do.
      return false;
    }

    // Questions to evict (everything beyond the newest `limit`).
    const keep = allRes.rows.slice(0, limit);
    const evict = allRes.rows.slice(limit);
    const keepIds = keep.map((r) => r['id'] as string);

    const prevDigest = await this.getDigest(userId);

    // Build the summary from evicted questions (oldest of the overflow).
    const evictedQuestions = evict
      .map((r) => r['question'] as string)
      .reverse(); // oldest first for coherent summarization
    const newDigest = await summarize(evictedQuestions, prevDigest?.digest ?? null);

    // Persist the new digest, then delete evicted rows.
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO chat_digest (user_id, digest, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET digest = excluded.digest, updated_at = excluded.updated_at`,
      args: [userId, newDigest, now],
    });

    // Delete evicted rows (idempotent).
    for (const row of evict) {
      await db.execute({
        sql: 'DELETE FROM chat_recent_questions WHERE id = ?',
        args: [row['id'] as string],
      });
    }

    logger.info(`Digest refreshed for ${userId}: evicted ${evict.length} questions (kept ${keepIds.length})`);
    return true;
  }

  // ──────────────────────────────────────────────────────────────
  // Semantic answer cache (per-user, never expires)
  // ──────────────────────────────────────────────────────────────

  /**
   * Look up the top-K most similar cached answers for a user's question, above a
   * similarity threshold. Returns [] when there is no sufficiently similar match.
   */
  async findSimilarAnswers(userId: string, question: string): Promise<CachedAnswer[]> {
    await this.init();
    const db = getTursoClient();

    const rows = await db.execute({
      sql: 'SELECT id, question, answer, embedding, created_at FROM chat_answer_cache WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      args: [userId, 500], // bounded fetch of this user's cache
    });

    if (rows.rows.length === 0) return [];

    const queryVec = (await this.embedder.embed(question)).embedding;

    const scored = rows.rows.map((row) => {
      const storedVec = this.parseVector(row['embedding']);
      return {
        id: row['id'] as string,
        userId,
        question: row['question'] as string,
        answer: row['answer'] as string,
        score: storedVec.length ? cosineSimilarity(queryVec, storedVec) : 0,
        createdAt: row['created_at'] as string,
      };
    });

    const threshold = envFloat('CHAT_SIMILARITY_THRESHOLD', DEFAULT_SIMILARITY_THRESHOLD);
    return scored
      .filter((s) => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.getTopK());
  }

  /** Cache a question→answer pair with its embedding. Never expires (per spec). */
  async cacheAnswer(userId: string, question: string, answer: string): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const vec = (await this.embedder.embed(question)).embedding;
    await db.execute({
      sql: `INSERT INTO chat_answer_cache (id, user_id, question, answer, embedding, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        this.makeId('ans'),
        userId,
        question,
        answer,
        JSON.stringify(vec),
        new Date().toISOString(),
      ],
    });
  }

  private parseVector(raw: unknown): number[] {
    try {
      const arr = JSON.parse(String(raw));
      return Array.isArray(arr) ? arr.map(Number) : [];
    } catch {
      return [];
    }
  }
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
