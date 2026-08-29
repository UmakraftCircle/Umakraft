import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from './index.js';
import type { PromptLibrary } from './prompts.js';

const logger = createLogger('GreetingService');

// ── Constants ──

const GREETING_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const GREETING_KEY_PREFIX = 'greeting-';
const MAX_CACHE_SIZE = 500;
const MIN_WORDS = 3;
const MAX_WORDS = 60;

// ── Bootstrap fallback pool (used when cache is completely empty) ──
// Multiple messages so even the empty-cache case uses random selection.

const BOOTSTRAP_FALLBACKS = [
  `@everyone ✨ A new friend just joined us! Please give them the warmest welcome — let's make them feel right at home! Every new face makes our community shine brighter. Say hi and show them what makes this server so special! 💕`,
  `@everyone 🌸 Look who just arrived! A brand new adventurer has stepped into our world — let's shower them with love and make their first day unforgettable! Drop a wave, share a smile, and show them why this is the best server around! 🎀`,
  `@everyone 🎮 A wild new player has appeared! Everyone gather 'round and give them the legendary welcome they deserve! New friends mean new stories, new laughs, and new memories — so let's make this one count! Welcome aboard! ⭐`,
  `@everyone 💫 Someone special just crossed the threshold into our server! Let's roll out the red carpet and show them the warmth of our amazing community. A simple "hello" goes a long way — be the reason they stay! 🌟`,
  `@everyone 🎀 Ding ding! A new member has joined the party! Time to pause the grind and give our freshest recruit the coziest welcome ever. Trust me, this community? Best decision they've made today. Say hi, everyone! 💖`,
];

// ── Lightweight internal cache (avoids circular dep on @ai-agent-platform/core) ──

interface CacheEntry {
  data: string;
  timestamp: number;
}

class GreetingCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() - entry.timestamp > GREETING_CACHE_TTL) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.data;
  }

  set(key: string, data: string): void {
    if (this.store.size >= MAX_CACHE_SIZE && !this.store.has(key)) {
      this.evictOldest();
    }
    this.store.set(key, { data, timestamp: Date.now() });
  }

  keys(prefix: string): string[] {
    const results: string[] = [];
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (!key.startsWith(prefix)) continue;
      if (now - entry.timestamp > GREETING_CACHE_TTL) {
        this.store.delete(key);
        continue;
      }
      results.push(key);
    }
    return results;
  }

  clear(): void {
    this.store.clear();
    logger.info('Greeting cache cleared.');
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxSize: MAX_CACHE_SIZE,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      evictions: this.evictions,
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.store) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) { this.store.delete(oldestKey); this.evictions++; }
  }
}

// ── GreetingService ───────────────────────────────────────

export class GreetingService {
  private cache: GreetingCache;
  private primaryAI: AIService | null;
  private fallbackAI: AIService | null;
  private brainAI: AIService | null;
  private prompts: PromptLibrary;
  private recentlySent = new Set<string>();

  /**
   * @param primaryAI   Primary Groq model (e.g. openai/gpt-oss-120b).
   *                     Pass null to operate in cache-only fallback mode.
   * @param prompts     PromptLibrary with a registered 'new-member-greeting' template.
   * @param fallbackAI  Optional fallback model (e.g. openai/gpt-oss-20b).
   *                     Used when the primary is rate-limited before falling back to cache.
   */
  constructor(
    primaryAI: AIService | null,
    prompts: PromptLibrary,
    fallbackAI: AIService | null = null,
    brainAI: AIService | null = null,
  ) {
    this.primaryAI = primaryAI;
    this.fallbackAI = fallbackAI;
    this.brainAI = brainAI;
    this.prompts = prompts;
    this.cache = new GreetingCache();

    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode (no AI provider)');
    logger.info(`GreetingService initialized (${parts.join(', ')})`);
  }

  // ── Public API ──────────────────────────────────────────

  /** Check if a member was already greeted recently (dedup guard). */
  hasRecentlyGreeted(memberId: string): boolean {
    return this.recentlySent.has(memberId);
  }

  /** Mark a member as greeted. Auto-clears after 10 minutes. */
  markGreeted(memberId: string): void {
    this.recentlySent.add(memberId);
    setTimeout(() => this.recentlySent.delete(memberId), 10 * 60_000).unref?.();
  }

  /**
   * Generate (or retrieve) a welcome greeting for a new server member.
   *
   * Strategy (5-tier fallback pyramid):
   *   1. Try primary Groq model (e.g. openai/gpt-oss-120b).
   *   2. On primary rate-limit → try fallback model (e.g. openai/gpt-oss-20b).
   *   3. On success → cache it for future fallback, return it.
   *   4. On failure (rate-limit, network, etc.) → fall back to cached pool.
   *   5. Empty cache → bootstrap pre-written pool.
   */
  async generateGreeting(
    memberName: string,
    serverName: string,
    memberCount: number,
  ): Promise<string> {
    // ── Tier 1: Primary model ──
    if (this.primaryAI) {
      try {
        const greeting = await this.#generateViaAI(this.primaryAI, memberName, serverName, memberCount);
        this.#cacheGreeting(greeting);
        logger.info(`Greeting generated via primary model (${this.primaryAI.getCurrentModel()})`);
        return greeting;
      } catch (err: any) {
        logger.warn(`Primary model failed: ${err.message}. Trying fallback model...`);
      }
    }

    // ── Tier 2: Fallback model (different model, same Groq API) ──
    if (this.fallbackAI) {
      try {
        const greeting = await this.#generateViaAI(this.fallbackAI, memberName, serverName, memberCount);
        this.#cacheGreeting(greeting);
        logger.info(`Greeting generated via fallback model (${this.fallbackAI.getCurrentModel()})`);
        return greeting;
      } catch (err: any) {
        logger.warn(`Fallback model also failed: ${err.message}. Falling back to cache.`);
      }
    }

    // ── Tier 3: Local brain (supervisor) retries once before cache ──
    if (this.brainAI) {
      try {
        const greeting = await this.#generateViaAI(this.brainAI, memberName, serverName, memberCount);
        this.#cacheGreeting(greeting);
        logger.info(`Greeting recovered by local brain (${this.brainAI.getCurrentModel()})`);
        return greeting;
      } catch (err: any) {
        logger.warn(`Local brain recovery failed: ${err.message}. Falling back to cache.`);
      }
    }

    // ── Tiers 4-5: Cache → Sole → Bootstrap ──
    return this.#fallbackGreeting();
  }

  /** Expose cache stats for monitoring/debugging. */
  getStats() {
    return this.cache.getStats();
  }

  /** Number of cached greetings in the pool. */
  getCachedCount(): number {
    return this.cache.keys(GREETING_KEY_PREFIX).length;
  }

  /** Clear the entire greeting cache. */
  clearCache(): void {
    this.cache.clear();
  }

  // ── Private ─────────────────────────────────────────────

  async #generateViaAI(
    ai: AIService,
    memberName: string,
    serverName: string,
    memberCount: number,
  ): Promise<string> {
    const rendered = this.prompts.render('new-member-greeting', {
      memberName,
      serverName,
      memberCount: String(memberCount),
    });

    if (!rendered) {
      throw new Error('Prompt template "new-member-greeting" not found in PromptLibrary');
    }

    const raw = await ai.generate({
      system: rendered.system,
      prompt: rendered.user,
    });

    return this.#sanitize(raw);
  }

  #cacheGreeting(greeting: string): void {
    const cacheKey = `${GREETING_KEY_PREFIX}${Date.now()}`;
    this.cache.set(cacheKey, greeting);
    logger.info(`Greeting cached (key: ${cacheKey}, words: ${greeting.split(/\s+/).length})`);
  }

  /**
   * Fallback: randomly pick a cached greeting from the pool.
   *   - ≥ 2 cached → randomly choose one
   *   - 1 cached   → use it
   *   - 0 cached   → bootstrap pool (random pick from 5 pre-written messages)
   */
  #fallbackGreeting(): string {
    const pool = this.cache.keys(GREETING_KEY_PREFIX);

    if (pool.length >= 2) {
      const shuffled = pool.sort(() => Math.random() - 0.5);
      for (const key of shuffled) {
        const msg = this.cache.get(key);
        if (msg) {
          logger.info(`Fallback: randomly selected cached greeting (pool: ${pool.length})`);
          return msg;
        }
      }
    }

    if (pool.length === 1) {
      const msg = this.cache.get(pool[0]);
      if (msg) {
        logger.info('Fallback: using sole cached greeting');
        return msg;
      }
    }

    logger.warn('Fallback: no cached greetings — using random bootstrap message');
    return BOOTSTRAP_FALLBACKS[Math.floor(Math.random() * BOOTSTRAP_FALLBACKS.length)];
  }

  #sanitize(raw: string): string {
    let greeting = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();

    // Remove stray quotes the model might wrap the response in
    if (
      (greeting.startsWith('"') && greeting.endsWith('"')) ||
      (greeting.startsWith("'") && greeting.endsWith("'"))
    ) {
      greeting = greeting.slice(1, -1).trim();
    }

    // Ensure @everyone is at the start
    if (!greeting.includes('@everyone')) {
      greeting = `@everyone ${greeting}`;
    }

    // Enforce word limit
    const words = greeting.split(/\s+/);
    if (words.length < MIN_WORDS) throw new Error('AI response too short');
    if (words.length > MAX_WORDS) {
      greeting = words.slice(0, MAX_WORDS).join(' ') + ' 💕';
    }

    return greeting;
  }
}
