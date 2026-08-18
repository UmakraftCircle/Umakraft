import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ChatMemory');

/**
 * Durable, long-term memory for the `/chat` command.
 *
 * Three logically distinct tiers, so weak inferences never contaminate the
 * user's real, validated facts:
 *
 *   1. durable memory  — explicit/validated facts (favourites, story progress,
 *                        reply style). Carries `source` + `confidence`.
 *   2. observations     — inferred, lower-confidence information (e.g. a passing
 *                        mention of a character, NOT a stated favourite).
 *   3. notes            — manually/agent-curated miscellaneous context.
 *
 * Every field is keyed by the Discord user id (global across channels/servers),
 * matching the `/ask` conversation memory convention (see conversation-memory.ts).
 */

export type MemorySource = 'explicit' | 'inferred';
export type ReplyStyle = 'formal' | 'casual' | 'in_character';

/** Structured story/progress state (updateable field-by-field). */
export interface StoryProgress {
  mainStoryChapter?: string | null;
  trainingCampaign?: string | null;
  clubRankTier?: string | null;
  gamemode?: string | null;
  [key: string]: string | null | undefined;
}

interface ObservationRow {
  id: string;
  userId: string;
  content: string;
  confidence: number;
  createdAt: string;
}

/** A single durable user-memory record (favourites + progress + reply style). */
export interface DurableMemory {
  userId: string;
  favoriteUmamusume: string[];
  favoriteTeam: string[];
  favoriteSupportCards: string[];
  storyProgress: StoryProgress;
  replyStylePreference: ReplyStyle | null;
  source: MemorySource;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_CONFIDENCE = 1.0;

export class ChatMemoryStore {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();

    // ── durable memory (one row per user) ──
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_durable_memory (
        user_id                 TEXT PRIMARY KEY,
        favorite_umamusume      TEXT NOT NULL DEFAULT '[]',
        favorite_team           TEXT NOT NULL DEFAULT '[]',
        favorite_support_cards  TEXT NOT NULL DEFAULT '[]',
        story_progress          TEXT NOT NULL DEFAULT '{}',
        reply_style_preference  TEXT,
        source                  TEXT NOT NULL DEFAULT 'explicit',
        confidence              REAL NOT NULL DEFAULT 1.0,
        created_at              TEXT NOT NULL,
        updated_at              TEXT NOT NULL
      )
    `);

    // ── observations (inferred, lower confidence — one row per observation) ──
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_observations (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        content     TEXT NOT NULL,
        confidence  REAL NOT NULL DEFAULT 0.5,
        created_at  TEXT NOT NULL
      )
    `);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_chat_obs_user ON chat_observations (user_id, created_at)'
    );

    // ── notes (agent-curated miscellaneous context) ──
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_notes (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        content     TEXT NOT NULL,
        created_at  TEXT NOT NULL
      )
    `);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_chat_notes_user ON chat_notes (user_id, created_at)'
    );

    this.tableReady = true;
    logger.info('chat memory tables ready (durable_memory, observations, notes)');
  }

  private makeId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private parseJson<T>(raw: unknown, fallback: T): T {
    try {
      return JSON.parse(String(raw)) as T;
    } catch {
      return fallback;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Durable memory (explicit facts)
  // ──────────────────────────────────────────────────────────────

  async getMemory(userId: string): Promise<DurableMemory | null> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT * FROM chat_durable_memory WHERE user_id = ?',
      args: [userId],
    });
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      userId,
      favoriteUmamusume: this.parseJson<string[]>(row['favorite_umamusume'], []),
      favoriteTeam: this.parseJson<string[]>(row['favorite_team'], []),
      favoriteSupportCards: this.parseJson<string[]>(row['favorite_support_cards'], []),
      storyProgress: this.parseJson<StoryProgress>(row['story_progress'], {}),
      replyStylePreference: (row['reply_style_preference'] as ReplyStyle | null) ?? null,
      source: (row['source'] as MemorySource) ?? 'explicit',
      confidence: Number(row['confidence']) || DEFAULT_CONFIDENCE,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    };
  }

  /**
   * Set (or replace) a durable favourite list. The latest explicit statement wins:
   * any prior value — explicit or inferred — is overwritten with `confidence = 1.0`
   * and `source = 'explicit'`.
   */
  async setFavorite(
    userId: string,
    field: 'favorite_umamusume' | 'favorite_team' | 'favorite_support_cards',
    values: string[],
  ): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const now = new Date().toISOString();
    const column =
      field === 'favorite_umamusume'
        ? 'favorite_umamusume'
        : field === 'favorite_team'
          ? 'favorite_team'
          : 'favorite_support_cards';

    const json = JSON.stringify(this.dedupe(values));
    await db.execute({
      sql: `INSERT INTO chat_durable_memory
              (user_id, ${column}, source, confidence, created_at, updated_at)
            VALUES (?, ?, 'explicit', 1.0, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              ${column}      = excluded.${column},
              source         = 'explicit',
              confidence     = 1.0,
              updated_at     = excluded.updated_at`,
      args: [userId, json, now, now],
    });
    logger.info(`Set ${field} for ${userId}: ${values.join(', ') || '(empty)'}`);
  }

  /** Field-by-field update of structured story progress. */
  async updateStoryProgress(userId: string, patch: StoryProgress): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const now = new Date().toISOString();
    const current = await this.getMemory(userId);
    const merged: StoryProgress = { ...(current?.storyProgress ?? {}), ...patch };
    const json = JSON.stringify(merged);
    await db.execute({
      sql: `INSERT INTO chat_durable_memory
              (user_id, story_progress, source, confidence, created_at, updated_at)
            VALUES (?, ?, 'explicit', 1.0, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              story_progress = excluded.story_progress,
              source         = 'explicit',
              confidence     = 1.0,
              updated_at     = excluded.updated_at`,
      args: [userId, json, now, now],
    });
  }

  /** Set the user's preferred reply style (controlled enum). */
  async setReplyStyle(userId: string, style: ReplyStyle): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO chat_durable_memory
              (user_id, reply_style_preference, source, confidence, created_at, updated_at)
            VALUES (?, ?, 'explicit', 1.0, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              reply_style_preference = excluded.reply_style_preference,
              source                  = 'explicit',
              confidence              = 1.0,
              updated_at              = excluded.updated_at`,
      args: [userId, style, now, now],
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Observations (inferred, lower confidence)
  // ──────────────────────────────────────────────────────────────

  /** Store an inferred (low-confidence) observation — NOT a validated favourite. */
  async addObservation(userId: string, content: string, confidence = 0.5): Promise<void> {
    await this.init();
    const db = getTursoClient();
    await db.execute({
      sql: 'INSERT INTO chat_observations (id, user_id, content, confidence, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [this.makeId('obs'), userId, content, confidence, new Date().toISOString()],
    });
  }

  async getObservations(userId: string, limit = 20): Promise<ObservationRow[]> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: `SELECT id, user_id, content, confidence, created_at
            FROM chat_observations
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [userId, limit],
    });
    return res.rows.map((row) => ({
      id: row['id'] as string,
      userId: row['user_id'] as string,
      content: row['content'] as string,
      confidence: Number(row['confidence']),
      createdAt: row['created_at'] as string,
    }));
  }

  // ──────────────────────────────────────────────────────────────
  // Notes (agent-curated misc context)
  // ──────────────────────────────────────────────────────────────

  async addNote(userId: string, content: string): Promise<void> {
    await this.init();
    const db = getTursoClient();
    await db.execute({
      sql: 'INSERT INTO chat_notes (id, user_id, content, created_at) VALUES (?, ?, ?, ?)',
      args: [this.makeId('note'), userId, content, new Date().toISOString()],
    });
  }

  async getNotes(userId: string, limit = 20): Promise<{ id: string; content: string; createdAt: string }[]> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: `SELECT id, content, created_at FROM chat_notes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [userId, limit],
    });
    return res.rows.map((row) => ({
      id: row['id'] as string,
      content: row['content'] as string,
      createdAt: row['created_at'] as string,
    }));
  }

  private dedupe(values: string[]): string[] {
    return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
  }
}

export const chatMemoryStore = new ChatMemoryStore();
