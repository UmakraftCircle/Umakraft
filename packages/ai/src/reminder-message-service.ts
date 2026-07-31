import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from './index.js';
import type { PromptLibrary } from './prompts.js';

const logger = createLogger('ReminderService');

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const MIN_WORDS = 100;
const MAX_WORDS = 150;

// ── Trainer gap data shape ───────────────────────────────

export interface TrainerGap {
  trainerName: string;
  discordUserId: string;
  monthlyFans: number;
  deficit: number; // 50M - monthlyFans
}

// ── Bootstrap pool (5 Hana-style generic encouragements) ─

const BOOTSTRAP_POOL: string[] = [
  `@everyone 🌸 Rise and shine, trainers! It's a brand new day on the turf and the monthly leaderboard is waiting for your next big stride! The 50M Minimum milestone is the goal this month — and every single training session, every race entry, every fan connection brings you one gallop closer to that finish line. Don't look at the gap and feel discouraged — look at how far you've already come and feel PROUD. The paddock is buzzing, the grandstand is ready, and this month's story is still being written by YOU. Keep those hooves thundering, keep that racing heart beating strong, and let's make today count toward something amazing! GALLOP ONWARD, EVERYONE! 💕🐎✨`,

  `@everyone 🐎 Good morning, racing family! The monthly fan tally is ticking up and every single one of you is making progress toward that shining 50M milestone! Some of you are in the home stretch, others are building momentum — but here's the beautiful truth about the turf: every race matters, every stride counts, and every day is a fresh chance to close the gap a little more. The training grounds are open, the fans are cheering, and the paddock is full of potential champions just waiting for their moment. Don't compare your chapter one to someone else's chapter ten — your racing story is YOURS, and it's unfolding exactly as it should. Let's make today a LEGENDARY training day! ⭐🎀💫`,

  `@everyone 🌟 Morning check-in, everyone! The monthly leaderboard is updating and the race to 50M is ON! Think of this month as one long, beautiful race — not a sprint but a marathon across rolling turf, with training montages, strategic gallops, and moments of pure racing magic along the way. Some days you'll gain millions, other days thousands — but every fan is a heartbeat supporting your journey, and every stride brings you closer to that Minimum milestone. The grandstand is filling up, the commentator is warming up, and your name is already on the leaderboard — now it's just about climbing higher. Stay consistent, stay passionate, and trust the training! 🏆🐎💕`,

  `@everyone 🌸 The morning turf is fresh and the monthly clock is ticking — but there's no pressure here, just POSSIBILITY! Every trainer linked to this server is on their own unique racing journey toward 50M monthly fans, and every single one of you has what it takes to get there. The gap might look big today, but remember — great racers aren't made in a single gallop. They're forged in the daily grind, the early morning training sessions, the races where you push just a little harder than yesterday. The paddock believes in you. The fans believe in you. And most importantly — Hana believes in you! Now let's see those hooves fly! 💫👑⭐`,

  `@everyone 🏆 The sun is up and so are the monthly stakes! Whether you're 10M away or just 500K from the 50M milestone, this morning is YOURS to seize on the track. Every champion started somewhere — standing at the starting gate with nothing but heart and a dream of thundering across the finish line to the roar of the grandstand. Your monthly tally is climbing, your training is paying off, and the paddock is taking notice of your consistency. Don't let the numbers intimidate you — let them MOTIVATE you! The turf is calling, the fans are waiting, and this month's leaderboard has your name written all over it. GO GO GO, TRAINERS! 🎀⚡🐎`,
];

// ── Lightweight cache ─────────────────────────────────────

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

// ── ReminderMessageService ────────────────────────────────

export class ReminderMessageService {
  private cache: ReminderCache;
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
    this.cache = new ReminderCache();

    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode');
    logger.info(`ReminderMessageService initialized (${parts.join(', ')})`);
  }

  // ── Public API ──────────────────────────────────────────

  /**
   * Generate a daily gap reminder for trainers still below 50M monthly.
   * 5-tier fallback: primary → fallback → random cache → sole cache → bootstrap
   */
  async generateReminder(
    gaps: TrainerGap[],
    serverName: string,
  ): Promise<string> {
    const trainerData = this.#formatTrainerData(gaps);

    // Tier 1: Primary
    if (this.primaryAI) {
      try {
        const msg = await this.#generateViaAI(this.primaryAI, trainerData, serverName);
        this.cache.set(`reminder-${Date.now()}`, msg);
        logger.info(`Gap reminder generated via primary (${gaps.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Gap reminder primary failed: ${err.message}. Trying fallback...`);
      }
    }

    // Tier 2: Fallback
    if (this.fallbackAI) {
      try {
        const msg = await this.#generateViaAI(this.fallbackAI, trainerData, serverName);
        this.cache.set(`reminder-${Date.now()}`, msg);
        logger.info(`Gap reminder generated via fallback (${gaps.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Gap reminder fallback failed: ${err.message}. Going to cache...`);
      }
    }

    // Tiers 3-5: Cache → Sole → Bootstrap
    return this.#fallbackReminder();
  }

  getPoolSize(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }

  // ── Private ─────────────────────────────────────────────

  async #generateViaAI(
    ai: AIService,
    trainerData: string,
    serverName: string,
  ): Promise<string> {
    const rendered = this.prompts.render('daily-reminder', {
      trainerData,
      serverName,
    });

    if (!rendered) throw new Error('Prompt template "daily-reminder" not found');

    const raw = await ai.generate({
      system: rendered.system,
      prompt: rendered.user
        .replaceAll('${trainerData}', trainerData)
        .replaceAll('${serverName}', serverName),
    });

    return this.#sanitize(raw);
  }

  #fallbackReminder(): string {
    const pool = this.cache.keys();
    const info = BOOTSTRAP_POOL;

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

    logger.warn(`Gap reminder fallback: bootstrap (${info.length} available)`);
    return info[Math.floor(Math.random() * info.length)];
  }

  #formatTrainerData(gaps: TrainerGap[]): string {
    return gaps
      .map((g, i) => {
        const m = g.monthlyFans >= 1_000_000
          ? `${(g.monthlyFans / 1_000_000).toFixed(1)}M`
          : `${(g.monthlyFans / 1_000).toFixed(1)}K`;
        const d = g.deficit >= 1_000_000
          ? `${(g.deficit / 1_000_000).toFixed(1)}M`
          : `${(g.deficit / 1_000).toFixed(1)}K`;
        return `  ${i + 1}. ${g.trainerName} — ${m} monthly fans so far, needs ${d} more to reach 50M Minimum`;
      })
      .join('\n');
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
