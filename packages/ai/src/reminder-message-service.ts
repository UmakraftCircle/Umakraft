import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from './index.js';
import type { PromptLibrary } from './prompts.js';

const logger = createLogger('ReminderService');

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const MIN_WORDS = 100;
const MAX_WORDS = 150;

export interface TrainerGap {
  trainerName: string;
  discordUserId: string;
  trainerId: string;
  monthlyFans: number;
  deficit: number;
}

const BOOTSTRAP_POOL: string[] = [
  `@everyone 🌸 Rise and shine, trainers!`,
  `@everyone 🐎 Good morning, racing family!`,
  `@everyone 🌟 Morning check-in, everyone!`,
  `@everyone 🌸 The morning turf is fresh`,
  `@everyone 🏆 The sun is up and so are the monthly stakes!`,
];

interface CacheEntry { data: string; timestamp: number; }

class ReminderCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  get(key: string): string | null {
    const e = this.store.get(key);
    if (!e) { this.misses++; return null; }
    if (Date.now() - e.timestamp > CACHE_TTL) { this.store.delete(key); this.misses++; return null; }
    this.hits++; return e.data;
  }

  set(key: string, data: string): void {
    if (this.store.size >= MAX_CACHE_SIZE && !this.store.has(key)) {
      let oldestK: string | null = null; let oldestT = Infinity;
      for (const [k, v] of this.store) { if (v.timestamp < oldestT) { oldestT = v.timestamp; oldestK = k; } }
      if (oldestK) this.store.delete(oldestK);
    }
    this.store.set(key, { data, timestamp: Date.now() });
  }

  keys(): string[] {
    const r: string[] = [];
    const now = Date.now();
    for (const [k, e] of this.store) {
      if (now - e.timestamp > CACHE_TTL) { this.store.delete(k); continue; }
      r.push(k);
    }
    return r;
  }

  clear(): void { this.store.clear(); }
  get size(): number { return this.keys().length; }
}

export class ReminderMessageService {
  private cache: ReminderCache;
  private primaryAI: AIService | null;
  private fallbackAI: AIService | null;
  private brainAI: AIService | null;
  private prompts: PromptLibrary;

  constructor(primaryAI: AIService | null, prompts: PromptLibrary, fallbackAI: AIService | null = null, brainAI: AIService | null = null) {
    this.primaryAI = primaryAI;
    this.fallbackAI = fallbackAI;
    this.brainAI = brainAI;
    this.prompts = prompts;
    this.cache = new ReminderCache();
    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode');
    logger.info(`ReminderMessageService initialized (${parts.join(', ')})`);
  }

  async generateReminder(gaps: TrainerGap[], serverName: string): Promise<string> {
    const trainerData = this.#formatTrainerData(gaps);
    if (this.primaryAI) {
      try {
        const msg = await this.#generateViaAI(this.primaryAI, trainerData, gaps, serverName);
        this.cache.set(`reminder-${Date.now()}`, msg);
        logger.info(`Gap reminder generated via primary (${gaps.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Gap reminder primary failed: ${err.message}. Trying fallback...`);
      }
    }
    if (this.fallbackAI) {
      try {
        const msg = await this.#generateViaAI(this.fallbackAI, trainerData, gaps, serverName);
        this.cache.set(`reminder-${Date.now()}`, msg);
        logger.info(`Gap reminder generated via fallback (${gaps.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Gap reminder fallback failed: ${err.message}. Going to cache...`);
      }
    }
    // Tier 3: Local brain (supervisor) retries once before cache
    if (this.brainAI) {
      try {
        const msg = await this.#generateViaAI(this.brainAI, trainerData, gaps, serverName);
        this.cache.set(`reminder-${Date.now()}`, msg);
        logger.info(`Gap reminder recovered by local brain (${gaps.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Gap reminder brain recovery failed: ${err.message}. Going to cache...`);
      }
    }

    return this.#fallbackReminder();
  }

  getPoolSize(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }

  async #generateViaAI(ai: AIService, trainerData: string, gaps: TrainerGap[], serverName: string): Promise<string> {
    const rendered = this.prompts.render('daily-reminder', { trainerData, serverName });
    if (!rendered) throw new Error('Prompt template "daily-reminder" not found');
    const raw = await ai.generate({ system: rendered.system, prompt: rendered.user });
    const sanitized = this.#sanitize(raw);
    this.#validateMentions(sanitized, gaps);
    return sanitized;
  }

  #fallbackReminder(): string {
    const pool = this.cache.keys();
    if (pool.length >= 2) {
      const shuffled = pool.sort(() => Math.random() - 0.5);
      for (const key of shuffled) {
        const msg = this.cache.get(key);
        if (msg) { logger.info(`Gap reminder fallback: random cache (${pool.length})`); return msg; }
      }
    }
    if (pool.length === 1) {
      const msg = this.cache.get(pool[0]);
      if (msg) { logger.info('Gap reminder fallback: sole cached'); return msg; }
    }
    logger.warn(`Gap reminder fallback: bootstrap (${BOOTSTRAP_POOL.length} available)`);
    return BOOTSTRAP_POOL[Math.floor(Math.random() * BOOTSTRAP_POOL.length)];
  }

  #formatTrainerData(gaps: TrainerGap[]): string {
    return gaps.map((g, i) => {
      const m = g.monthlyFans >= 1_000_000 ? `${(g.monthlyFans / 1_000_000).toFixed(1)}M` : `${(g.monthlyFans / 1_000).toFixed(1)}K`;
      const d = g.deficit >= 1_000_000 ? `${(g.deficit / 1_000_000).toFixed(1)}M` : `${(g.deficit / 1_000).toFixed(1)}K`;
      return `  ${i + 1}. <@${g.discordUserId}> (${g.trainerName}) — ${m} monthly fans so far, needs ${d} more to reach 50M Minimum`;
    }).join('\n');
  }

  #validateMentions(msg: string, gaps: TrainerGap[]): void {
    const realIds = new Set(gaps.map(g => g.discordUserId));
    const plain = [...msg.matchAll(/@(?!\d{17,19}>)(\w+)/g)];
    if (plain.length > 0) throw new Error(`Invented @mentions: ${plain.map(m => m[0]).join(', ')} — retrying`);
    const ids = [...msg.matchAll(/<@(\d{17,19})>/g)].map(m => m[1]);
    const hallucinated = ids.filter(id => !realIds.has(id));
    if (hallucinated.length > 0) throw new Error(`Unknown user IDs mentioned: ${hallucinated.join(', ')} — retrying`);
  }

  #sanitize(raw: string): string {
    let msg = raw.trim();
    if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'"))) msg = msg.slice(1, -1).trim();
    if (!msg.includes('@everyone')) msg = `@everyone ${msg}`;
    const words = msg.split(/\s+/);
    if (words.length < MIN_WORDS) throw new Error('AI response too short');
    if (words.length > MAX_WORDS) msg = words.slice(0, MAX_WORDS).join(' ') + ' 👑';
    return msg;
  }
}