import { getTursoClient, isTursoConfigured } from './turso.js';
import { conversationMemoryStore } from './conversation-memory.js';
import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from '@ai-agent-platform/ai';

const logger = createLogger('SharedUserMemory');

export type MemoryCategory = 'identity' | 'preference' | 'project' | 'goal' | 'interest' | 'fact';

export interface UserProfile {
  userId: string; // e.g. "discord:123456"
  rawUserId: string; // e.g. "123456"
  preferredName?: string | null;
  timezone?: string | null;
  interests: string[];
  projects: string[];
  preferences: string[];
  goals: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UserMemoryItem {
  id: string;
  userId: string; // formatted "discord:..."
  category: MemoryCategory;
  fact: string;
  importance: number; // 0.0 to 1.0
  sourceMessage?: string;
  createdAt: string;
}

export interface ConversationSummaryRecord {
  id: string;
  userId: string;
  channelId: string;
  summary: string;
  turnCount: number;
  updatedAt: string;
}

export interface MemoryExtractionResult {
  importance: number;
  save: boolean;
  category?: MemoryCategory;
  fact?: string;
  profileUpdates?: {
    preferredName?: string;
    timezone?: string;
    interests?: string[];
    projects?: string[];
    preferences?: string[];
    goals?: string[];
    metadata?: Record<string, any>;
  };
}

export interface MemoryContext {
  profile: UserProfile;
  memories: UserMemoryItem[];
  summary: string | null;
  systemPromptInjection: string;
}

export function formatUserId(userId: string): string {
  const trimmed = (userId || '').trim();
  if (!trimmed) return 'discord:unknown';
  if (trimmed.startsWith('discord:')) return trimmed;
  return `discord:${trimmed}`;
}

export function extractRawUserId(formattedId: string): string {
  if (formattedId.startsWith('discord:')) {
    return formattedId.slice('discord:'.length);
  }
  return formattedId;
}

function dedupeArray(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

/**
 * SharedUserMemoryStore
 *
 * Provides a unified long-term memory, profile, and conversation summarization
 * layer accessed by both `/ask` and `/chat` (and Direct Messages).
 *
 * Persisted in Turso SQLite tables (with in-memory fallback when unconfigured).
 */
export class SharedUserMemoryStore {
  private tableReady = false;
  private useMemoryFallback = false;

  private profiles = new Map<string, UserProfile>();
  private memories = new Map<string, UserMemoryItem[]>();
  private summaries = new Map<string, ConversationSummaryRecord>();

  async init(): Promise<void> {
    if (this.tableReady) return;

    if (!isTursoConfigured()) {
      this.useMemoryFallback = true;
      this.tableReady = true;
      logger.info('SharedUserMemoryStore using in-memory store (no Turso credentials configured)');
      return;
    }

    try {
      const db = getTursoClient();

      // ── User Profiles ──
      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          user_id         TEXT PRIMARY KEY,
          preferred_name  TEXT,
          timezone        TEXT,
          interests       TEXT NOT NULL DEFAULT '[]',
          projects        TEXT NOT NULL DEFAULT '[]',
          preferences     TEXT NOT NULL DEFAULT '[]',
          goals           TEXT NOT NULL DEFAULT '[]',
          metadata        TEXT NOT NULL DEFAULT '{}',
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        )
      `);

      // ── Long-term Memories ──
      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_memories (
          id              TEXT PRIMARY KEY,
          user_id         TEXT NOT NULL,
          category        TEXT NOT NULL,
          fact            TEXT NOT NULL,
          importance      REAL NOT NULL DEFAULT 0.5,
          source_message  TEXT,
          created_at      TEXT NOT NULL
        )
      `);
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories (user_id, importance, created_at)'
      );

      // ── Conversation Summaries ──
      await db.execute(`
        CREATE TABLE IF NOT EXISTS conversation_summaries (
          id              TEXT PRIMARY KEY,
          user_id         TEXT NOT NULL,
          channel_id      TEXT NOT NULL,
          summary         TEXT NOT NULL,
          turn_count      INTEGER NOT NULL DEFAULT 0,
          updated_at      TEXT NOT NULL
        )
      `);
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_conv_summaries_scope ON conversation_summaries (user_id, channel_id)'
      );

      this.tableReady = true;
      logger.info('SharedUserMemoryStore tables ready in Turso');
    } catch (err: any) {
      logger.warn(`Turso shared user memory init failed, falling back to in-memory: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      this.tableReady = true;
    }
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

  /** Reset internal maps for testing. */
  clearForTesting(): void {
    this.profiles.clear();
    this.memories.clear();
    this.summaries.clear();
  }

  // ──────────────────────────────────────────────────────────────
  // User Profile Management
  // ──────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<UserProfile> {
    await this.init();
    const formattedId = formatUserId(userId);
    const rawId = extractRawUserId(formattedId);

    if (this.useMemoryFallback) {
      let prof = this.profiles.get(formattedId);
      if (!prof) {
        const now = new Date().toISOString();
        prof = {
          userId: formattedId,
          rawUserId: rawId,
          preferredName: null,
          timezone: null,
          interests: [],
          projects: [],
          preferences: [],
          goals: [],
          metadata: {},
          createdAt: now,
          updatedAt: now,
        };
        this.profiles.set(formattedId, prof);
      }
      return { ...prof };
    }

    try {
      const db = getTursoClient();
      const res = await db.execute({
        sql: 'SELECT * FROM user_profiles WHERE user_id = ?',
        args: [formattedId],
      });

      if (res.rows.length === 0) {
        const now = new Date().toISOString();
        const newProf: UserProfile = {
          userId: formattedId,
          rawUserId: rawId,
          preferredName: null,
          timezone: null,
          interests: [],
          projects: [],
          preferences: [],
          goals: [],
          metadata: {},
          createdAt: now,
          updatedAt: now,
        };
        await db.execute({
          sql: `INSERT INTO user_profiles (user_id, preferred_name, timezone, interests, projects, preferences, goals, metadata, created_at, updated_at)
                VALUES (?, NULL, NULL, '[]', '[]', '[]', '[]', '{}', ?, ?)`,
          args: [formattedId, now, now],
        });
        this.profiles.set(formattedId, newProf);
        return newProf;
      }

      const row = res.rows[0];
      const prof: UserProfile = {
        userId: formattedId,
        rawUserId: rawId,
        preferredName: (row['preferred_name'] as string | null) ?? null,
        timezone: (row['timezone'] as string | null) ?? null,
        interests: this.parseJson<string[]>(row['interests'], []),
        projects: this.parseJson<string[]>(row['projects'], []),
        preferences: this.parseJson<string[]>(row['preferences'], []),
        goals: this.parseJson<string[]>(row['goals'], []),
        metadata: this.parseJson<Record<string, any>>(row['metadata'], {}),
        createdAt: row['created_at'] as string,
        updatedAt: row['updated_at'] as string,
      };
      this.profiles.set(formattedId, prof);
      return prof;
    } catch (err: any) {
      logger.warn(`Turso getProfile failed, using memory fallback: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      return this.getProfile(userId);
    }
  }

  async updateProfile(userId: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    await this.init();
    const formattedId = formatUserId(userId);
    const existing = await this.getProfile(userId);
    const now = new Date().toISOString();

    if (patch.preferredName !== undefined) {
      existing.preferredName = patch.preferredName;
    }
    if (patch.timezone !== undefined) {
      existing.timezone = patch.timezone;
    }
    if (patch.interests) {
      existing.interests = dedupeArray([...existing.interests, ...patch.interests]);
    }
    if (patch.projects) {
      existing.projects = dedupeArray([...existing.projects, ...patch.projects]);
    }
    if (patch.preferences) {
      existing.preferences = dedupeArray([...existing.preferences, ...patch.preferences]);
    }
    if (patch.goals) {
      existing.goals = dedupeArray([...existing.goals, ...patch.goals]);
    }
    if (patch.metadata) {
      existing.metadata = { ...existing.metadata, ...patch.metadata };
    }
    existing.updatedAt = now;

    this.profiles.set(formattedId, existing);
    logger.info(`[SharedUserMemory] profile updated for ${formattedId}: ${JSON.stringify(patch)}`);

    if (this.useMemoryFallback) {
      return { ...existing };
    }

    try {
      const db = getTursoClient();
      await db.execute({
        sql: `INSERT INTO user_profiles
                (user_id, preferred_name, timezone, interests, projects, preferences, goals, metadata, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET
                preferred_name = excluded.preferred_name,
                timezone       = excluded.timezone,
                interests      = excluded.interests,
                projects       = excluded.projects,
                preferences    = excluded.preferences,
                goals          = excluded.goals,
                metadata       = excluded.metadata,
                updated_at     = excluded.updated_at`,
        args: [
          formattedId,
          existing.preferredName ?? null,
          existing.timezone ?? null,
          JSON.stringify(existing.interests),
          JSON.stringify(existing.projects),
          JSON.stringify(existing.preferences),
          JSON.stringify(existing.goals),
          JSON.stringify(existing.metadata || {}),
          existing.createdAt,
          now,
        ],
      });
    } catch (err: any) {
      logger.warn(`Turso updateProfile failed: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
    }

    return { ...existing };
  }

  // ──────────────────────────────────────────────────────────────
  // Long-Term Fact Memories
  // ──────────────────────────────────────────────────────────────

  async addMemory(userId: string, item: Omit<UserMemoryItem, 'id' | 'createdAt'>): Promise<UserMemoryItem> {
    await this.init();
    const formattedId = formatUserId(userId);
    const now = new Date().toISOString();
    const id = this.makeId('mem');

    const memoryItem: UserMemoryItem = {
      id,
      userId: formattedId,
      category: item.category,
      fact: item.fact.trim(),
      importance: Math.max(0, Math.min(1, item.importance)),
      sourceMessage: item.sourceMessage,
      createdAt: now,
    };

    // Update memory map
    const list = this.memories.get(formattedId) || [];
    // Deduplicate identical facts
    const existingIndex = list.findIndex((m) => m.fact.toLowerCase() === memoryItem.fact.toLowerCase());
    if (existingIndex >= 0) {
      list[existingIndex] = memoryItem;
    } else {
      list.unshift(memoryItem);
    }
    this.memories.set(formattedId, list.slice(0, 100));

    logger.info(
      `[SharedUserMemory] memory saved for ${formattedId}: "${memoryItem.fact}" (importance: ${memoryItem.importance.toFixed(2)}, category: ${memoryItem.category})`
    );

    if (this.useMemoryFallback) {
      return memoryItem;
    }

    try {
      const db = getTursoClient();
      await db.execute({
        sql: `INSERT INTO user_memories (id, user_id, category, fact, importance, source_message, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          memoryItem.id,
          memoryItem.userId,
          memoryItem.category,
          memoryItem.fact,
          memoryItem.importance,
          memoryItem.sourceMessage ?? null,
          memoryItem.createdAt,
        ],
      });
    } catch (err: any) {
      logger.warn(`Turso addMemory failed: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
    }

    return memoryItem;
  }

  async getMemories(
    userId: string,
    options?: { minImportance?: number; limit?: number; category?: MemoryCategory }
  ): Promise<UserMemoryItem[]> {
    await this.init();
    const formattedId = formatUserId(userId);
    const minImp = options?.minImportance ?? 0.5;
    const limit = options?.limit ?? 20;

    if (this.useMemoryFallback) {
      let list = this.memories.get(formattedId) || [];
      if (options?.category) {
        list = list.filter((m) => m.category === options.category);
      }
      list = list.filter((m) => m.importance >= minImp);
      return list.slice(0, limit);
    }

    try {
      const db = getTursoClient();
      let sql = `SELECT * FROM user_memories WHERE user_id = ? AND importance >= ?`;
      const args: any[] = [formattedId, minImp];

      if (options?.category) {
        sql += ` AND category = ?`;
        args.push(options.category);
      }
      sql += ` ORDER BY importance DESC, created_at DESC LIMIT ?`;
      args.push(limit);

      const res = await db.execute({ sql, args });
      const results: UserMemoryItem[] = res.rows.map((r) => ({
        id: r['id'] as string,
        userId: r['user_id'] as string,
        category: r['category'] as MemoryCategory,
        fact: r['fact'] as string,
        importance: Number(r['importance']),
        sourceMessage: (r['source_message'] as string | null) ?? undefined,
        createdAt: r['created_at'] as string,
      }));

      this.memories.set(formattedId, results);
      return results;
    } catch (err: any) {
      logger.warn(`Turso getMemories failed: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      return this.getMemories(userId, options);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Conversation Summaries
  // ──────────────────────────────────────────────────────────────

  async getSummary(userId: string, channelId: string): Promise<ConversationSummaryRecord | null> {
    await this.init();
    const formattedId = formatUserId(userId);
    const key = `${formattedId}:${channelId}`;

    if (this.useMemoryFallback) {
      return this.summaries.get(key) ?? null;
    }

    try {
      const db = getTursoClient();
      const res = await db.execute({
        sql: `SELECT * FROM conversation_summaries WHERE user_id = ? AND channel_id = ? LIMIT 1`,
        args: [formattedId, channelId],
      });
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const record: ConversationSummaryRecord = {
        id: row['id'] as string,
        userId: row['user_id'] as string,
        channelId: row['channel_id'] as string,
        summary: row['summary'] as string,
        turnCount: Number(row['turn_count']) || 0,
        updatedAt: row['updated_at'] as string,
      };
      this.summaries.set(key, record);
      return record;
    } catch (err: any) {
      logger.warn(`Turso getSummary failed: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
      return this.summaries.get(key) ?? null;
    }
  }

  async updateConversationSummary(
    userId: string,
    channelId: string,
    customSummaryText?: string
  ): Promise<ConversationSummaryRecord> {
    await this.init();
    const formattedId = formatUserId(userId);
    const key = `${formattedId}:${channelId}`;
    const now = new Date().toISOString();

    let summaryText = customSummaryText;
    if (!summaryText) {
      // Build high-quality summary from profile, top memories, and recent turns
      const profile = await this.getProfile(userId);
      const topMemories = await this.getMemories(userId, { minImportance: 0.7, limit: 5 });
      const recentTurns = await conversationMemoryStore.recent(userId, channelId, 6);

      const summaryLines: string[] = [];
      summaryLines.push(`User is ${profile.preferredName || 'a Trainer'}.`);
      if (profile.projects.length) {
        summaryLines.push(`Building ${profile.projects.join(', ')}.`);
      }
      if (profile.preferences.length) {
        summaryLines.push(`Prefers ${profile.preferences.join(', ')}.`);
      }
      if (profile.interests.length) {
        summaryLines.push(`Interested in ${profile.interests.join(', ')}.`);
      }
      if (profile.goals.length) {
        summaryLines.push(`Goal: ${profile.goals.join(', ')}.`);
      }
      if (topMemories.length) {
        for (const m of topMemories.slice(0, 3)) {
          if (!summaryLines.some((line) => line.includes(m.fact))) {
            summaryLines.push(`${m.fact}.`);
          }
        }
      }
      if (recentTurns.length > 0) {
        const lastUserTurn = recentTurns.filter((t) => t.role === 'user').pop();
        if (lastUserTurn) {
          summaryLines.push(`Recent interaction: "${lastUserTurn.content.slice(0, 80)}"`);
        }
      }

      summaryText = summaryLines.join('\n');
    }

    const existing = await this.getSummary(userId, channelId);
    const turnCount = (existing?.turnCount ?? 0) + 1;
    const id = existing?.id ?? this.makeId('sum');

    const record: ConversationSummaryRecord = {
      id,
      userId: formattedId,
      channelId,
      summary: summaryText,
      turnCount,
      updatedAt: now,
    };

    this.summaries.set(key, record);
    logger.info(`[SharedUserMemory] conversation summary updated for ${key} (turn ${turnCount})`);

    if (this.useMemoryFallback) {
      return record;
    }

    try {
      const db = getTursoClient();
      await db.execute({
        sql: `INSERT INTO conversation_summaries (id, user_id, channel_id, summary, turn_count, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                summary    = excluded.summary,
                turn_count = excluded.turn_count,
                updated_at = excluded.updated_at`,
        args: [record.id, record.userId, record.channelId, record.summary, record.turnCount, now],
      });
    } catch (err: any) {
      logger.warn(`Turso updateConversationSummary failed: ${err?.message ?? err}`);
      this.useMemoryFallback = true;
    }

    return record;
  }

  // ──────────────────────────────────────────────────────────────
  // Memory Extraction & Scoring Logic
  // ──────────────────────────────────────────────────────────────

  /**
   * Evaluates importance and extracts structured memory elements from a message.
   * Uses precise deterministic heuristics with high confidence scoring.
   *
   * Stores:
   *  ✅ preferences (e.g. "My favorite language is TypeScript")
   *  ✅ goals (e.g. "My goal is to launch the bot")
   *  ✅ projects (e.g. "I'm building a Discord AI assistant")
   *  ✅ identity (e.g. "My name is Alex", "My timezone is Asia/Manila")
   *  ✅ recurring interests (e.g. "I'm interested in Discord bots and AI")
   *
   * Ignores:
   *  ❌ "hi", "thanks", "lol", short queries asking what the bot knows
   */
  scoreAndExtractMemory(message: string): MemoryExtractionResult {
    const text = (message || '').trim();

    if (!text) {
      return { importance: 0.0, save: false };
    }

    // 1. Ignore filter: Casual chatter, short acknowledgments
    const ignoreRegex =
      /^(?:hi|hello|hey|yo|sup|hiya|howdy|good\s+(?:morning|afternoon|evening|night)|thanks|thank\s+you|ty|thx|lol|lmao|haha|ok|okay|k|cool|nice|bye|goodbye|see\s+ya|yes|no|yep|nope|sure|great|awesome|understood)[\s!.?]*$/i;
    if (ignoreRegex.test(text)) {
      return { importance: 0.0, save: false };
    }

    // 2. Ignore filter: Inquiries asking for stored memory (not providing new facts)
    const inquiryRegex =
      /^(?:what(?:'s|\s+is)\s+my|who\s+am\s+i|do\s+you\s+(?:know|remember)\s+my|tell\s+me\s+(?:my|about\s+my)|what\s+project\s+am\s+i)/i;
    if (inquiryRegex.test(text)) {
      return { importance: 0.0, save: false };
    }

    let maxImportance = 0.0;
    let category: MemoryCategory | undefined;
    const facts: string[] = [];
    const profileUpdates: {
      preferredName?: string;
      timezone?: string;
      interests?: string[];
      projects?: string[];
      preferences?: string[];
      goals?: string[];
      metadata?: Record<string, any>;
    } = {};

    // 3. Identity extraction: Name
    // "My name is Alex", "Call me Alex", "I go by Alex"
    const nameMatch =
      text.match(/(?:my\s+name\s+is|call\s+me|i\s+go\s+by)\s+([a-zA-Z0-9_-]{2,30})/i) ||
      text.match(/^i(?:'m|\s+am)\s+([A-Z][a-zA-Z0-9_-]{1,25})[.!?]?$/);
    if (nameMatch) {
      const rawName = nameMatch[1].trim();
      const nonNames = ['building', 'working', 'interested', 'trying', 'here', 'back', 'fine', 'good', 'sad', 'happy', 'ready', 'sorry'];
      if (!nonNames.includes(rawName.toLowerCase())) {
        profileUpdates.preferredName = rawName;
        facts.push(`User's name is ${rawName}`);
        maxImportance = Math.max(maxImportance, 0.95);
        category = category || 'identity';
      }
    }

    // 4. Identity extraction: Timezone
    // "My timezone is Asia/Manila", "I'm in timezone UTC+8"
    const tzMatch = text.match(/(?:my\s+timezone\s+is|i(?:'m|\s+am)\s+in\s+timezone)\s+([a-zA-Z0-9_/+ -]{3,40})/i);
    if (tzMatch) {
      const tz = tzMatch[1].trim();
      profileUpdates.timezone = tz;
      facts.push(`User's timezone is ${tz}`);
      maxImportance = Math.max(maxImportance, 0.85);
      category = category || 'identity';
    }

    // 5. Project extraction
    // "I'm building a Discord AI assistant", "I am building a Discord bot", "Working on project X"
    const projectMatch = text.match(
      /(?:i(?:'m|\s+am)\s+building|i(?:'m|\s+am)\s+working\s+on|my\s+project\s+is|working\s+on\s+a)\s+([^.!?\n]{3,80})/i
    );
    if (projectMatch) {
      const proj = projectMatch[1].trim().replace(/^a\s+/i, '');
      profileUpdates.projects = dedupeArray([...(profileUpdates.projects || []), proj]);
      facts.push(`User is building ${proj}`);
      maxImportance = Math.max(maxImportance, 0.9);
      category = category || 'project';
    }

    // 6. Preference extraction: Favorite language / game / things
    // "My favorite language is TypeScript", "My favorite game is Genshin Impact"
    const favMatch = text.match(
      /my\s+fav(?:ou?rite)?\s+([a-zA-Z0-9_\s]{1,30})\s+(?:is|are)\s+([^.!?\n]{1,80})/i
    );
    if (favMatch) {
      const itemType = favMatch[1].trim();
      const val = favMatch[2].trim();
      const prefStr = `Favorite ${itemType}: ${val}`;
      profileUpdates.preferences = dedupeArray([...(profileUpdates.preferences || []), prefStr]);
      facts.push(`User's favorite ${itemType} is ${val}`);
      maxImportance = Math.max(maxImportance, 0.9);
      category = category || 'preference';
    }

    // "I prefer TypeScript over JavaScript", "I prefer X"
    const preferMatch = text.match(/i\s+prefer\s+([^.!?\n]{2,80})/i);
    if (preferMatch) {
      const pref = preferMatch[1].trim();
      profileUpdates.preferences = dedupeArray([...(profileUpdates.preferences || []), `Prefers ${pref}`]);
      facts.push(`User prefers ${pref}`);
      maxImportance = Math.max(maxImportance, 0.85);
      category = category || 'preference';
    }

    // 7. Interest extraction
    // "I'm interested in Discord bots and AI", "Interested in X"
    const interestMatch = text.match(/(?:i(?:'m|\s+am)\s+interested\s+in|interested\s+in)\s+([^.!?\n]{2,80})/i);
    if (interestMatch) {
      const rawInterests = interestMatch[1]
        .split(/,|\band\b/i)
        .map((s) => s.trim())
        .filter(Boolean);
      profileUpdates.interests = dedupeArray([...(profileUpdates.interests || []), ...rawInterests]);
      facts.push(`User is interested in ${interestMatch[1].trim()}`);
      maxImportance = Math.max(maxImportance, 0.85);
      category = category || 'interest';
    }

    // 8. Goal extraction
    // "My goal is to finish the bot", "I want to achieve X"
    const goalMatch = text.match(/(?:my\s+goal\s+is\s+to|i\s+aim\s+to|my\s+target\s+is\s+to)\s+([^.!?\n]{2,80})/i);
    if (goalMatch) {
      const goal = goalMatch[1].trim();
      profileUpdates.goals = dedupeArray([...(profileUpdates.goals || []), goal]);
      facts.push(`User's goal is to ${goal}`);
      maxImportance = Math.max(maxImportance, 0.85);
      category = category || 'goal';
    }

    if (maxImportance >= 0.5 && facts.length > 0) {
      return {
        importance: maxImportance,
        save: true,
        category: category || 'fact',
        fact: facts.join('; '),
        profileUpdates,
      };
    }

    // Default: not a key persistent fact
    return { importance: 0.1, save: false };
  }

  /**
   * Extracts and persists memory & profile updates if importance score allows saving.
   */
  async extractAndSaveMemory(
    userId: string,
    message: string,
    options?: { aiService?: AIService }
  ): Promise<MemoryExtractionResult> {
    const formattedId = formatUserId(userId);
    let extracted = this.scoreAndExtractMemory(message);

    // Optional AI extraction fallback if score is low but prompt has potential personal fact
    if (!extracted.save && options?.aiService && message.length > 15 && /\b(?:my|i'm|i am|mine|we)\b/i.test(message)) {
      try {
        const prompt = `You are a user memory extractor. Determine if this message reveals a user identity, preference, project, goal, or interest.
Message: "${message}"

If not worth remembering, return {"importance": 0.1, "save": false}.
If worth remembering, return JSON:
{"importance": 0.85, "save": true, "category": "project"|"preference"|"identity"|"goal"|"interest", "fact": "User is...", "profileUpdates": {"preferredName"?: "...", "projects"?: ["..."], "preferences"?: ["..."], "interests"?: ["..."], "goals"?: ["..."]}}`;

        const res = await options.aiService.generate({ prompt, maxTokens: 100 });
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.save && parsed.importance >= 0.7 && parsed.fact) {
            extracted = parsed;
          }
        }
      } catch {
        // Safe ignore
      }
    }

    if (extracted.save && extracted.fact) {
      // 1. Add to long-term memories
      await this.addMemory(formattedId, {
        userId: formattedId,
        category: extracted.category || 'fact',
        fact: extracted.fact,
        importance: extracted.importance,
        sourceMessage: message,
      });

      // 2. Apply profile updates
      if (extracted.profileUpdates) {
        await this.updateProfile(formattedId, extracted.profileUpdates);
      }
    }

    return extracted;
  }

  // ──────────────────────────────────────────────────────────────
  // Memory Context Retrieval (for injection into ask.ts and chat.ts)
  // ──────────────────────────────────────────────────────────────

  async retrieveMemoryContext(userId: string, channelId: string, limitMemories = 8): Promise<MemoryContext> {
    const formattedId = formatUserId(userId);
    const profile = await this.getProfile(userId);
    const memories = await this.getMemories(userId, { minImportance: 0.5, limit: limitMemories });
    const summaryRecord = await this.getSummary(userId, channelId);

    logger.info(
      `[SharedUserMemory] memory retrieved for ${formattedId}: ${memories.length} facts, profile name: ${profile.preferredName ?? 'unset'}`
    );

    // Format prompt injection
    const lines: string[] = [
      '=== USER PROFILE & LONG-TERM MEMORY ===',
      `User ID: ${profile.userId}`,
    ];

    if (profile.preferredName) {
      lines.push(`Preferred Name: ${profile.preferredName}`);
    }
    if (profile.timezone) {
      lines.push(`Timezone: ${profile.timezone}`);
    }
    if (profile.projects.length) {
      lines.push(`Known Projects: ${profile.projects.join(', ')}`);
    }
    if (profile.preferences.length) {
      lines.push(`Preferences: ${profile.preferences.join('; ')}`);
    }
    if (profile.interests.length) {
      lines.push(`Interests: ${profile.interests.join(', ')}`);
    }
    if (profile.goals.length) {
      lines.push(`Goals: ${profile.goals.join(', ')}`);
    }

    if (memories.length > 0) {
      lines.push('');
      lines.push('Key Facts Remembered:');
      for (const m of memories) {
        lines.push(`- ${m.fact} (confidence: ${m.importance.toFixed(2)})`);
      }
    }

    if (summaryRecord?.summary) {
      lines.push('');
      lines.push('Conversation Summary:');
      lines.push(summaryRecord.summary);
    }

    lines.push('=========================================');

    const systemPromptInjection = lines.join('\n');

    return {
      profile,
      memories,
      summary: summaryRecord?.summary ?? null,
      systemPromptInjection,
    };
  }
}

export const sharedUserMemoryStore = new SharedUserMemoryStore();
