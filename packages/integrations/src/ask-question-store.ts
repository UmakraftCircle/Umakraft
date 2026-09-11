import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';
import crypto from 'node:crypto';

const logger = createLogger('AskQuestionStore');

export interface AskQuestionRecord {
  id: string;
  userId: string;
  channelId: string;
  guildId?: string | null;
  question: string;
  answer: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'expired';
  usageCount: number;
  maxUses: number;
  createdAt: string;
  answeredAt?: string | null;
  updatedAt: string;
}

export class AskQuestionStore {
  private tableReady = false;
  private memoryStore = new Map<string, AskQuestionRecord>();
  private useMemoryFallback = false;

  private isTursoAvailable(): boolean {
    return Boolean(process.env['TURSO_URL'] && process.env['TURSO_AUTH_TOKEN']);
  }

  private async init(): Promise<void> {
    if (this.tableReady) return;
    if (!this.isTursoAvailable()) {
      this.useMemoryFallback = true;
      this.tableReady = true;
      logger.info('AskQuestionStore initialized using in-memory store (no Turso credentials configured)');
      return;
    }

    try {
      const db = getTursoClient();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ask_questions (
          id           TEXT PRIMARY KEY,
          user_id      TEXT NOT NULL,
          channel_id   TEXT NOT NULL,
          guild_id     TEXT,
          question     TEXT NOT NULL,
          answer       TEXT,
          status       TEXT NOT NULL DEFAULT 'pending',
          usage_count  INTEGER NOT NULL DEFAULT 0,
          max_uses     INTEGER NOT NULL DEFAULT 3,
          created_at   TEXT NOT NULL,
          answered_at  TEXT,
          updated_at   TEXT NOT NULL
        )
      `);
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_ask_questions_user ON ask_questions (user_id, created_at)'
      );
      this.tableReady = true;
      logger.info('ask_questions table ready in Turso');
    } catch (err: any) {
      logger.warn(`Turso table init failed, falling back to memory: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      this.tableReady = true;
    }
  }

  private generateId(): string {
    const randomHex = crypto.randomBytes(4).toString('hex');
    const timeSuffix = Date.now().toString(36).slice(-4);
    return `qid_${randomHex}${timeSuffix}`;
  }

  /**
   * Create and store a new question. Does NOT generate an answer.
   */
  async create(data: {
    question: string;
    userId: string;
    channelId: string;
    guildId?: string | null;
    customId?: string;
  }): Promise<AskQuestionRecord> {
    await this.init();
    const id = data.customId || this.generateId();
    const now = new Date().toISOString();

    const record: AskQuestionRecord = {
      id,
      userId: data.userId,
      channelId: data.channelId,
      guildId: data.guildId ?? null,
      question: data.question.trim(),
      answer: null,
      status: 'pending',
      usageCount: 0,
      maxUses: 3,
      createdAt: now,
      answeredAt: null,
      updatedAt: now,
    };

    if (this.useMemoryFallback) {
      this.memoryStore.set(id, { ...record });
      return record;
    }

    try {
      const db = getTursoClient();
      await db.execute({
        sql: `INSERT INTO ask_questions (id, user_id, channel_id, guild_id, question, answer, status, usage_count, max_uses, created_at, answered_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          record.id,
          record.userId,
          record.channelId,
          record.guildId,
          record.question,
          record.answer,
          record.status,
          record.usageCount,
          record.maxUses,
          record.createdAt,
          record.answeredAt,
          record.updatedAt,
        ],
      });
      // Also cache in memory for ultra-fast lookups
      this.memoryStore.set(id, { ...record });
      return record;
    } catch (err: any) {
      logger.error(`Failed to insert question into Turso, storing in memory: ${err?.message ?? err}`);
      this.memoryStore.set(id, { ...record });
      return record;
    }
  }

  /**
   * Retrieve a question by its unique ID.
   */
  async get(id: string): Promise<AskQuestionRecord | null> {
    await this.init();
    const trimmedId = id.trim();

    if (this.useMemoryFallback) {
      const rec = this.memoryStore.get(trimmedId);
      return rec ? { ...rec } : null;
    }

    try {
      const db = getTursoClient();
      const res = await db.execute({
        sql: 'SELECT * FROM ask_questions WHERE id = ?',
        args: [trimmedId],
      });

      if (res.rows.length === 0) {
        return this.memoryStore.get(trimmedId) ? { ...this.memoryStore.get(trimmedId)! } : null;
      }

      const row = res.rows[0];
      const record: AskQuestionRecord = {
        id: String(row['id']),
        userId: String(row['user_id']),
        channelId: String(row['channel_id']),
        guildId: row['guild_id'] ? String(row['guild_id']) : null,
        question: String(row['question']),
        answer: row['answer'] ? String(row['answer']) : null,
        status: String(row['status']) as AskQuestionRecord['status'],
        usageCount: Number(row['usage_count'] ?? 0),
        maxUses: Number(row['max_uses'] ?? 3),
        createdAt: String(row['created_at']),
        answeredAt: row['answered_at'] ? String(row['answered_at']) : null,
        updatedAt: String(row['updated_at']),
      };

      this.memoryStore.set(trimmedId, { ...record });
      return record;
    } catch (err: any) {
      logger.warn(`Turso get error, checking memory: ${err?.message ?? err}`);
      const rec = this.memoryStore.get(trimmedId);
      return rec ? { ...rec } : null;
    }
  }

  /**
   * Atomically mark a question as 'generating' to prevent duplicate answer generation.
   * Returns true if status was 'pending' and successfully transitioned to 'generating'.
   */
  async markGenerating(id: string): Promise<boolean> {
    const record = await this.get(id);
    if (!record) return false;
    if (record.status !== 'pending') return false;

    const now = new Date().toISOString();
    record.status = 'generating';
    record.updatedAt = now;
    this.memoryStore.set(id, { ...record });

    if (!this.useMemoryFallback) {
      try {
        const db = getTursoClient();
        await db.execute({
          sql: `UPDATE ask_questions SET status = 'generating', updated_at = ? WHERE id = ? AND status = 'pending'`,
          args: [now, id],
        });
      } catch (err: any) {
        logger.warn(`Turso markGenerating update warning: ${err?.message ?? err}`);
      }
    }
    return true;
  }

  /**
   * Reset status back to 'pending' if answer generation fails.
   */
  async resetPending(id: string): Promise<void> {
    const record = await this.get(id);
    if (!record) return;
    const now = new Date().toISOString();
    record.status = 'pending';
    record.updatedAt = now;
    this.memoryStore.set(id, { ...record });

    if (!this.useMemoryFallback) {
      try {
        const db = getTursoClient();
        await db.execute({
          sql: `UPDATE ask_questions SET status = 'pending', updated_at = ? WHERE id = ?`,
          args: [now, id],
        });
      } catch (err: any) {
        logger.warn(`Turso resetPending update warning: ${err?.message ?? err}`);
      }
    }
  }

  /**
   * Permanently store the generated answer and record the 1st usage.
   */
  async saveGeneratedAnswer(id: string, answer: string): Promise<AskQuestionRecord | null> {
    const record = await this.get(id);
    if (!record) return null;

    const now = new Date().toISOString();
    record.answer = answer;
    record.status = 'completed';
    record.usageCount = 1; // 1st retrieval upon generation
    record.answeredAt = now;
    record.updatedAt = now;
    this.memoryStore.set(id, { ...record });

    if (!this.useMemoryFallback) {
      try {
        const db = getTursoClient();
        await db.execute({
          sql: `UPDATE ask_questions
                SET answer = ?, status = 'completed', usage_count = 1, answered_at = ?, updated_at = ?
                WHERE id = ?`,
          args: [answer, now, now, id],
        });
      } catch (err: any) {
        logger.warn(`Turso saveGeneratedAnswer warning: ${err?.message ?? err}`);
      }
    }
    return record;
  }

  /**
   * Increment usage count for an existing answer.
   * If usageCount >= 3, returns expired: true.
   */
  async incrementUsage(id: string): Promise<{
    success: boolean;
    expired: boolean;
    usageCount: number;
    record: AskQuestionRecord | null;
  }> {
    const record = await this.get(id);
    if (!record) {
      return { success: false, expired: false, usageCount: 0, record: null };
    }

    if (record.usageCount >= record.maxUses) {
      return { success: false, expired: true, usageCount: record.usageCount, record };
    }

    const newUsageCount = record.usageCount + 1;
    const now = new Date().toISOString();
    record.usageCount = newUsageCount;
    if (newUsageCount >= record.maxUses) {
      record.status = 'expired';
    }
    record.updatedAt = now;
    this.memoryStore.set(id, { ...record });

    if (!this.useMemoryFallback) {
      try {
        const db = getTursoClient();
        await db.execute({
          sql: `UPDATE ask_questions SET usage_count = ?, status = ?, updated_at = ? WHERE id = ?`,
          args: [newUsageCount, record.status, now, id],
        });
      } catch (err: any) {
        logger.warn(`Turso incrementUsage warning: ${err?.message ?? err}`);
      }
    }

    return {
      success: true,
      expired: false,
      usageCount: newUsageCount,
      record,
    };
  }

  /**
   * Correct an answer for a given question ID (admin operation).
   * Overrides the answer with an accurate verified answer, marks status as 'completed',
   * and optionally resets usage count to 0 so users can retrieve it.
   */
  async correctAnswer(
    id: string,
    newAnswer: string,
    resetUsage: boolean = true
  ): Promise<{ previousAnswer: string | null; record: AskQuestionRecord | null }> {
    const record = await this.get(id);
    if (!record) return { previousAnswer: null, record: null };

    const previousAnswer = record.answer;
    const now = new Date().toISOString();

    record.answer = newAnswer;
    record.status = 'completed';
    if (resetUsage) {
      record.usageCount = 0;
    }
    record.answeredAt = now;
    record.updatedAt = now;
    this.memoryStore.set(id, { ...record });

    if (!this.useMemoryFallback) {
      try {
        const db = getTursoClient();
        await db.execute({
          sql: `UPDATE ask_questions
                SET answer = ?, status = 'completed', usage_count = ?, answered_at = ?, updated_at = ?
                WHERE id = ?`,
          args: [newAnswer, record.usageCount, now, now, id],
        });
      } catch (err: any) {
        logger.warn(`Turso correctAnswer warning: ${err?.message ?? err}`);
      }
    }

    return { previousAnswer, record: { ...record } };
  }

  /**
   * List recent questions for autocomplete or administration.
   */
  async listRecent(limit: number = 25, query?: string): Promise<AskQuestionRecord[]> {
    await this.init();
    const q = query ? query.toLowerCase().trim() : '';

    if (this.useMemoryFallback || this.memoryStore.size > 0) {
      const records = Array.from(this.memoryStore.values());
      const filtered = q
        ? records.filter(
            (r) =>
              r.id.toLowerCase().includes(q) ||
              r.question.toLowerCase().includes(q) ||
              (r.answer && r.answer.toLowerCase().includes(q))
          )
        : records;

      filtered.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      if (filtered.length >= limit || this.useMemoryFallback) {
        return filtered.slice(0, limit);
      }
    }

    if (!this.useMemoryFallback) {
      try {
        const db = getTursoClient();
        const sql = q
          ? `SELECT * FROM ask_questions WHERE id LIKE ? OR question LIKE ? ORDER BY created_at DESC LIMIT ?`
          : `SELECT * FROM ask_questions ORDER BY created_at DESC LIMIT ?`;
        const args = q ? [`%${q}%`, `%${q}%`, limit] : [limit];
        const res = await db.execute({ sql, args });

        return res.rows.map((row) => ({
          id: String(row['id']),
          userId: String(row['user_id']),
          channelId: String(row['channel_id']),
          guildId: row['guild_id'] ? String(row['guild_id']) : null,
          question: String(row['question']),
          answer: row['answer'] ? String(row['answer']) : null,
          status: String(row['status']) as AskQuestionRecord['status'],
          usageCount: Number(row['usage_count'] ?? 0),
          maxUses: Number(row['max_uses'] ?? 3),
          createdAt: String(row['created_at']),
          answeredAt: row['answered_at'] ? String(row['answered_at']) : null,
          updatedAt: String(row['updated_at']),
        }));
      } catch (err: any) {
        logger.warn(`Turso listRecent error: ${err?.message ?? err}`);
      }
    }

    return Array.from(this.memoryStore.values()).slice(0, limit);
  }

  /**
   * Clear in-memory state (useful for tests).
   */
  clearMemory(): void {
    this.memoryStore.clear();
  }
}

export const askQuestionStore = new AskQuestionStore();
