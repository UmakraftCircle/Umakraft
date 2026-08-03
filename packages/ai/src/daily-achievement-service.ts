import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from './index.js';
import type { PromptLibrary } from './prompts.js';

const logger = createLogger('DailyAchievementService');

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const MIN_WORDS = 100;
const MAX_WORDS = 200;

// ── Daily achiever data shape ───────────────────────────

export interface DailyAchiever {
  trainerName: string;
  discordUserId: string;
  trainerId: string;
  dailyGain: number;
  tier: string;  // Monthly achievement tier (e.g. "Legend", "Minimum", "-")
  rank: number; // 1-based
}

// ── Bootstrap pool (5 Hana-style top-10 evening recaps) ─

const BOOTSTRAP_POOL: string[] = [
  `@everyone 🌟 Evening turf report! The daily numbers are in and the paddock is buzzing with today's top performances! From blistering surges to steady climbs, our linked trainers showed up and showed OUT on the track today. Every single fan gain represents a stride taken, a race run, a heart won — and today's leaderboard tells a story of dedication that would make any trainer proud. The grandstand is still echoing with cheers for today's top performers, and the momentum they've built will carry straight into tomorrow's training. Rest well tonight, champions — the turf awaits your return at sunrise! 💕🐎✨`,

  `@everyone 🏆 The daily leaderboard has spoken! What a phenomenal day on the Umamusume turf — our top trainers left everything on the track and the numbers prove it! Whether it was a million-fan surge or a steady climb through the rankings, today was ALL about heart, hustle, and pure racing spirit. The paddock analysts are already circling names for tomorrow's watchlist, and the grandstand has a few new heroes to cheer for. Every stride you took today built momentum for the month ahead. Celebrate tonight, recharge those racing legs, and come back tomorrow ready to gallop even harder! ⭐🎀💫`,

  `@everyone 🌸 The evening bell has rung and today's daily achievement board is LIVE! Our linked trainers have been absolutely CRUSHING it — closing gaps, climbing ranks, and proving that consistency on the turf is the ultimate weapon. Today's top performers didn't just gain fans — they gained RESPECT from every corner of the paddock. The grandstand watched in awe as trainer after trainer pushed their limits and redefined what's possible in a single day of racing. This is the kind of energy that builds legendary months! Rest up, stay hungry, and let's make tomorrow even BIGGER! 🐎💫👑`,

  `@everyone 👑 Turf recap time! The daily fan gains are in and WOW — today was a masterclass in racing excellence from our linked trainers! Some galloped past personal records, others surged through the rankings like thoroughbreds hitting full stride, and every single one of them proved why they belong on this leaderboard. The paddock is still buzzing with excitement over today's standout performances, and the grandstand crowd? They're already counting down to tomorrow's action. Every day is a new race, a fresh start, another chance to thunder across the turf and make history. Fantastic work today — now let's chase even bigger dreams at sunrise! 🔥🏆💕`,

  `@everyone 🌟 The daily numbers don't lie — today was ABSOLUTELY ELECTRIC on the Umamusume turf! Our linked trainers came to race and the leaderboard is GLOWING with their achievements. From dramatic last-minute surges to consistent all-day grinding, the variety of brilliance on display today was genuinely inspiring. The paddock is tipping its hat, the commentators are losing their voices, and the monthly leaderboard got a serious shake-up thanks to today's efforts. This is what dedication looks like — day after day, stride after stride, building toward something legendary. Incredible work, everyone! Tomorrow's turf is waiting! 🎀⚡🐎`,
];

// ── Lightweight cache ────────────────────────────────────

interface CacheEntry { data: string; timestamp: number; }

class AchievementCache {
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

// ── DailyAchievementService ──────────────────────────────

export class DailyAchievementService {
  private cache: AchievementCache;
  private primaryAI: AIService | null;
  private fallbackAI: AIService | null;
  private prompts: PromptLibrary;

  constructor(
    primaryAI: AIService | null,
    prompts: PromptLibrary,
    fallbackAI: AIService | null = null,
  ) {
    this.primaryAI = primaryAI;
    this.fallbackAI = fallbackAI;
    this.prompts = prompts;
    this.cache = new AchievementCache();

    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode');
    logger.info(`DailyAchievementService initialized (${parts.join(', ')})`);
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Generate a daily top-10 achievement message celebrating the day's best performers.
   * 5-tier fallback: primary → fallback → random cache → sole cache → bootstrap
   */
  async generateDailyTop10(
    achievers: DailyAchiever[],
    serverName: string,
  ): Promise<string> {
    const achieverData = this.#formatAchieverData(achievers);

    // Tier 1: Primary
    if (this.primaryAI) {
      try {
        const msg = await this.#generateViaAI(this.primaryAI, achieverData, achievers, serverName);
        this.cache.set(`daily-achievement-${Date.now()}`, msg);
        logger.info(`Daily achievement generated via primary (${achievers.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Daily achievement primary failed: ${err.message}. Trying fallback...`);
      }
    }

    // Tier 2: Fallback
    if (this.fallbackAI) {
      try {
        const msg = await this.#generateViaAI(this.fallbackAI, achieverData, achievers, serverName);
        this.cache.set(`daily-achievement-${Date.now()}`, msg);
        logger.info(`Daily achievement generated via fallback (${achievers.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Daily achievement fallback failed: ${err.message}. Going to cache...`);
      }
    }

    // Tiers 3-5: Cache → Sole → Bootstrap
    return this.#fallbackAchievement();
  }

  getPoolSize(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }

  // ── Private ────────────────────────────────────────────

  async #generateViaAI(
    ai: AIService,
    achieverData: string,
    achievers: DailyAchiever[],
    serverName: string,
  ): Promise<string> {
    const rendered = this.prompts.render('daily-achievement', {
      achieverData,
      serverName,
      count: String(achievers.length),
    });

    if (!rendered) throw new Error('Prompt template "daily-achievement" not found');

    const raw = await ai.generate({
      system: rendered.system,
      prompt: rendered.user,
    });

    const sanitized = this.#sanitize(raw);
    this.#validateMentions(sanitized, achievers);
    return sanitized;
  }

  #fallbackAchievement(): string {
    const pool = this.cache.keys();
    const info = BOOTSTRAP_POOL;

    if (pool.length >= 2) {
      const shuffled = pool.sort(() => Math.random() - 0.5);
      for (const key of shuffled) {
        const msg = this.cache.get(key);
        if (msg) { logger.info(`Daily achievement fallback: random cache (${pool.length})`); return msg; }
      }
    }

    if (pool.length === 1) {
      const msg = this.cache.get(pool[0]);
      if (msg) { logger.info('Daily achievement fallback: sole cached'); return msg; }
    }

    logger.warn(`Daily achievement fallback: bootstrap (${info.length} available)`);
    return info[Math.floor(Math.random() * info.length)];
  }

  #formatAchieverData(achievers: DailyAchiever[]): string {
    const medals = ['🥇', '🥈', '🥉'];
    return achievers
      .map((a) => {
        const prefix = a.rank <= 3 ? medals[a.rank - 1] : `  ${a.rank}.`;
        const gain = a.dailyGain >= 1_000_000
          ? `${(a.dailyGain / 1_000_000).toFixed(1)}M`
          : a.dailyGain >= 1_000
            ? `${(a.dailyGain / 1_000).toFixed(1)}K`
            : String(a.dailyGain);
        const tierTag = a.tier && a.tier !== '-' ? ` [${a.tier}]` : '';
        return `  ${prefix} <@${a.discordUserId}> (${a.trainerName})${tierTag} — +${gain} fans today`;
      })
      .join('\n');
  }

  #validateMentions(msg: string, achievers: DailyAchiever[]): void {
    const realIds = new Set(achievers.map(a => a.discordUserId));
    // Reject plain @word mentions (not real Discord snowflakes)
    const plain = [...msg.matchAll(/@(?!\d{17,19}>)(\w+)/g)];
    if (plain.length > 0) {
      throw new Error(`Invented @mentions: ${plain.map(m => m[0]).join(', ')} — retrying`);
    }
    // Reject <@ID> mentions for IDs not in the achievers list
    const ids = [...msg.matchAll(/<@(\d{17,19})>/g)].map(m => m[1]);
    const hallucinated = ids.filter(id => !realIds.has(id));
    if (hallucinated.length > 0) {
      throw new Error(`Unknown user IDs mentioned: ${hallucinated.join(', ')} — retrying`);
    }
  }

  #sanitize(raw: string): string {
    let msg = raw.trim();
    if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'"))) {
      msg = msg.slice(1, -1).trim();
    }
    if (!msg.includes('@everyone')) msg = `@everyone ${msg}`;
    const words = msg.split(/\s+/);
    if (words.length < MIN_WORDS) throw new Error('AI response too short');
    if (words.length > MAX_WORDS) msg = words.slice(0, MAX_WORDS).join(' ') + ' 👑';
    return msg;
  }
}
