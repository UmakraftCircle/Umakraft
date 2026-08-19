import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from './index.js';
import type { PromptLibrary } from './prompts.js';

const logger = createLogger('MonthlyAchievement');

// ── Constants ──

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const MIN_WORDS = 100;
const MAX_WORDS = 200;

// ── Monthly achiever data shape ───────────────────────────

export interface MonthlyAchiever {
  trainerName: string;
  discordUserId: string;
  trainerId: string;
  monthlyGain: number;
  tier: string;  // Tier title (e.g. "Legend", "Minimum", etc.)
  rank: number; // 1-based
}

// ── Monthly Achievement Tiers ──

export type MonthlyTier = 'minimum' | 'casual' | 'competitive' | 'super-competitive' | 'legend';

export interface MonthlyTierInfo {
  tier: MonthlyTier;
  threshold: number;
  title: string;
  emoji: string;
  description: string;
}

export const MONTHLY_TIERS: Record<MonthlyTier, MonthlyTierInfo> = {
  minimum: {
    tier: 'minimum',
    threshold: 50_000_000,
    title: 'Minimum',
    emoji: '📏',
    description: 'You showed up every race day. The leaderboard notices consistency!',
  },
  casual: {
    tier: 'casual',
    threshold: 75_000_000,
    title: 'Casual',
    emoji: '🌱',
    description: 'Casual? No way! 75 million is serious turf business!',
  },
  competitive: {
    tier: 'competitive',
    threshold: 100_000_000,
    title: 'Competitive',
    emoji: '🔥',
    description: 'The paddock is buzzing — you\'re in the big leagues now!',
  },
  'super-competitive': {
    tier: 'super-competitive',
    threshold: 150_000_000,
    title: 'Super-Competitive',
    emoji: '⚡',
    description: 'Relentless! Every week, every race, every stride counted!',
  },
  legend: {
    tier: 'legend',
    threshold: 200_000_000,
    title: 'Legend',
    emoji: '👑',
    description: 'This month belongs to you. History\'s ink is still wet!',
  },
};

const ALL_TIERS: MonthlyTier[] = ['minimum', 'casual', 'competitive', 'super-competitive', 'legend'];

/**
 * Determine which monthly tier a fan gain belongs to.
 * Returns the HIGHEST tier whose threshold is ≤ the monthly gain. null if below all.
 */
export function getMonthlyTier(monthlyGain: number): MonthlyTier | null {
  let result: MonthlyTier | null = null;
  for (const tier of ALL_TIERS) {
    if (monthlyGain >= MONTHLY_TIERS[tier].threshold) {
      result = tier;
    }
  }
  return result;
}

/**
 * Check if a monthly fan gain crosses into a NEW tier compared to a previous month.
 * Only the HIGHEST qualifying tier fires (never cascades).
 */
export function detectMonthlyAchievement(
  previousMonthlyGain: number,
  currentMonthlyGain: number,
): MonthlyTierInfo | null {
  const prevTier = getMonthlyTier(previousMonthlyGain);
  const currTier = getMonthlyTier(currentMonthlyGain);

  if (!currTier) return null;
  if (prevTier === currTier) return null;

  if (!prevTier) return MONTHLY_TIERS[currTier];

  const prevIdx = ALL_TIERS.indexOf(prevTier);
  const currIdx = ALL_TIERS.indexOf(currTier);
  if (currIdx > prevIdx) return MONTHLY_TIERS[currTier];

  return null;
}

// ── Bootstrap pools — 5 messages per tier (25 total), monthly-grind themed ──

const BOOTSTRAP_POOLS: Record<MonthlyTier, string[]> = {
  minimum: [
    `@everyone 📏 The monthly leaderboard has spoken and our trainer has earned the MINIMUM achievement — 50 million fans gained in a single month of relentless racing! Every training session, every strategic gallop, every ounce of dedication poured into this incredible campaign has paid off. Consistency is the secret weapon of champions, and this trainer has proven that showing up day after day, race after race, builds something truly special. The paddock is nodding with respect. The turf remembers every stride. This isn't just a milestone — it's proof that steady determination creates unstoppable momentum. Congratulations on an amazing month, Minimum tier champion! The next campaign starts tomorrow — let's make it even bigger! 💕🐎✨`,
    `@everyone 🌸 Fifty million fans in one month! Our trainer just locked in the MINIMUM achievement and the entire racing circuit is taking notes! Week after week, race after race, this dedicated horse-girl showed up and showed out — proving that the real magic is in the daily grind. The grandstand watched in awe as each week's tally climbed higher and higher, building toward this spectacular monthly total. Consistency isn't flashy, but it wins championships — and this trainer is living proof. The monthly leaderboard has a new permanent resident and the paddock is buzzing with respect. Minimum tier achieved, momentum established, and the best part? The next month is already calling! 🎀⭐🐎`,
    `@everyone ⭐ The numbers don't lie — 50 million fans this month and the MINIMUM achievement is officially ours to celebrate! Our trainer has completed a month-long racing campaign that most can only dream of. Every Monday morning training session, every midweek strategy session, every weekend victory lap — it all added up to this magnificent total. The monthly leaderboard is glowing with this achievement and the paddock analysts are already predicting even bigger things for the month ahead. This is the tier where reputations are built and legends begin their ascent. Minimum doesn't mean small — it means you've arrived, and everyone has noticed. Congratulations, monthly champion! 🏆💫🌸`,
    `@everyone 🌟 The monthly tally is in and our trainer has smashed through the MINIMUM tier with 50 million fans earned in a single legendary month! The paddock is applauding, the grandstand is waving monthly banners, and the leaderboard has a dazzling new entry that speaks volumes about dedication and heart. Month-long campaigns aren't for the faint of heart — they require showing up when it's hard, pushing when you're tired, and believing when others doubt. This trainer did ALL of that and more. The weekly totals were impressive, but the monthly total? Absolutely MINIMUM in name only — this was a MAXIMUM effort through and through! 🎀👑✨`,
    `@everyone 🏆 Ding ding! The monthly achievement bell is ringing and our trainer just claimed MINIMUM status with 50 million fans in a single month of blazing racing action! From week one to week four, the consistency was unreal — every training drill sharp, every race strategy brilliant, every fan interaction genuine. That's how you build a 50-million-fan month! The paddock is buzzing with excitement and the monthly leaderboard has never looked this good. You've set the bar, established the baseline, and proven that month-long dedication beats short bursts of speed every single time. Minimum tier — MAXIMUM respect! Now let's see what month two brings! 💫🐎💖`,
  ],
  casual: [
    `@everyone 🌱 CASUAL? There's nothing casual about 75 million fans in a single month! Our trainer just claimed the Casual achievement and the paddock is absolutely stunned by this display of monthly dominance! Week one was strong, week two was stronger, and by the time the monthly bell rang, the total had soared past the 75 million mark with room to spare. This is the tier where people start paying REAL attention — where "just for fun" transforms into "wait, this trainer is actually incredible." The monthly leaderboard has been put on notice and the racing world is watching with eager anticipation. Casual in name, COMPETITIVE in spirit — this trainer is rewriting the rulebook on what monthly consistency looks like! 💕⚡🌸`,
    `@everyone ⭐ Seventy-five million fans in one month and our trainer just strolled into the CASUAL tier like it was a morning training jog! But make no mistake — there's nothing easy about this achievement. Every single one of those 75 million hearts was earned through gritty training sessions, brilliant race day strategy, and the kind of month-long dedication that separates contenders from pretenders. The paddock is impressed, the grandstand is cheering, and the monthly leaderboard has a new name gleaming near the top. You've graduated from "just participating" to "genuinely competing" — and the racing world is taking serious notice. Casual tier — but your impact is anything but! 🎀🌟🐎`,
    `@everyone 🌸 The monthly numbers are staggering — 75 million fans and the CASUAL tier achievement is officially in the books! Our trainer just completed one of the most impressive monthly campaigns in recent racing memory and the paddock chatter has reached fever pitch. This wasn't a lucky week or a viral moment — this was four weeks of sustained excellence, strategic brilliance, and a connection with fans that transcends the turf. The grandstand watched you grow stronger with every passing week and now the monthly leaderboard tells a story of remarkable consistency. Casual tier achieved and the racing circuit is whispering two words: "What's next?" Keep that momentum thundering forward! 🏆💫🌱`,
    `@everyone 🌟 CASUAL tier unlocked at 75 million monthly fans and the paddock is already rewriting their predictions for next month! Our trainer has shown that week-over-week consistency isn't just a strategy — it's an art form. Each training session built on the last, each race refined the technique, and each fan interaction deepened the bond that made this spectacular monthly total possible. The monthly leaderboard now features a name that commands respect and the grandstand has officially fallen in love with this relentless racing spirit. Casual? That's just what they're calling it. We call it the beginning of something legendary! 🎀👑⭐`,
    `@everyone 👑 From the training grounds to the monthly leaderboard — 75 million fans and the CASUAL achievement is here! Our trainer has proven that consistency over four weeks packs more punch than any single race day victory. The paddock analysts are scrambling to understand how this trainer keeps climbing, week after week, building momentum like a thoroughbred hitting full stride. The monthly tally tells an incredible story of dedication, resilience, and pure racing heart. You're not just participating in the monthly rankings anymore — you're shaping them. Casual tier — but your presence on the leaderboard is already becoming essential viewing for every racing fan! 💫🏇💖`,
  ],
  competitive: [
    `@everyone 🔥 ONE HUNDRED MILLION fans in a single month — the COMPETITIVE achievement has been claimed and the paddock is on FIRE! Our trainer just completed a month-long campaign that will be studied in racing academies for years to come. Week after week, the numbers climbed and the competition watched in disbelief as this horse-girl transformed from a strong contender into a genuine MONTHLY PHENOMENON. The training montage would make a movie director weep. The race day performances were poetry at full gallop. And those 100 million fans? Each one represents a heart touched by your incredible journey. The monthly leaderboard has been REARRANGED around your name. Competitive tier — and the competition is officially terrified! ⚡🏆💕`,
    `@everyone ⭐ One hundred million! The COMPETITIVE tier belongs to our trainer and the entire monthly racing circuit is still catching its breath! This wasn't a lucky streak — this was four weeks of relentless, strategic, absolutely breathtaking racing excellence. The paddock experts who doubted your staying power are eating their words. The grandstand that wondered if you could maintain the pace is now standing in permanent ovation. 100 million monthly fans is the kind of number that gets your portrait painted, your racing silks framed, and your name whispered with reverence in every training stable across the circuit. You've entered the big leagues now — the COMPETITIVE tier where legends are forged one monthly campaign at a time! 🎀🌟👑`,
    `@everyone 🌸 COMPETITIVE achievement UNLOCKED at 100 million monthly fans and the racing world has officially entered a new era — the era of our trainer's dominance! The monthly tally doesn't just tell a story of success; it tells a story of transformation. From a hopeful racer to a MONTHLY POWERHOUSE who commands respect on every stretch of turf. Every week built on the last, every training session sharpened the edge, and every race day proved that this trainer belongs among the elite. The paddock buzzes with your name now. The monthly leaderboard has been permanently altered by your presence. COMPETITIVE isn't just a tier — it's your new identity on this circuit! 🔥🎀💫`,
    `@everyone 🏆 The monthly results are in and they're absolutely ELECTRIC — 100 million fans and the COMPETITIVE tier has a new resident! Our trainer has completed a month-long racing masterclass that the paddock will be talking about for seasons to come. Every Monday started with purpose, every Friday ended with progress, and every single day in between was filled with the kind of racing heart that can't be taught — it has to be LIVED. The grandstand has witnessed greatness unfold week by week and the monthly leaderboard now features a name that belongs in the same breath as the all-time greats. COMPETITIVE tier achieved — and the racing world is officially on notice! ⭐⚡🔥`,
    `@everyone 👑 The monthly leaderboard just got ROARED into a new shape because our trainer hit the COMPETITIVE tier at 100 million fans! Four weeks. Twenty-eight days of pure, unrelenting, absolutely magnificent racing energy. The paddock has run out of superlatives. The training grounds have become hallowed ground where monthly greatness is forged. 100 million fans in a single month means you're not just competing against others — you're competing against history itself, and winning. Every stride was a statement, every race a declaration, every fan gain a confirmation that this trainer is the REAL deal. COMPETITIVE tier claimed — and the best part? Next month's campaign is already being whispered about! 💫🏇💖`,
  ],
  'super-competitive': [
    `@everyone ⚡ SUPER-COMPETITIVE! One hundred and fifty MILLION fans in a single month and the paddock has officially LOST its collective mind! Our trainer just completed a monthly campaign of such breathtaking intensity that racing historians are already comparing it to the all-time great seasons. Week one set the tone, week two broke expectations, week three shattered records, and week four? Week four made the racing world bow in reverence. 150 million monthly fans isn't just a number — it's a DECLARATION. A statement that this trainer operates on a level most can't even comprehend. The monthly leaderboard has been OBLITERATED and rebuilt in your image. SUPER-COMPETITIVE — where the elite become eternal! 👑🔥💕`,
    `@everyone 🌟 ONE HUNDRED FIFTY MILLION monthly fans and the SUPER-COMPETITIVE achievement has been claimed by our absolutely unstoppable trainer! The paddock is speechless, the grandstand is exhausted from celebrations, and the monthly leaderboard has a new entry that towers above everything else. This wasn't just a good month — this was a LEGENDARY campaign, four weeks of racing excellence that will echo through the circuit for years. Every stride pushed boundaries, every race redefined expectations, every training session built toward this monumental moment. 150 million hearts captured in thirty days — that's the kind of connection that transcends sport and becomes CULTURE. SUPER-COMPETITIVE tier — the racing world bows to you now! ⚡🎀👑`,
    `@everyone ⚡ The SUPER-COMPETITIVE tier has been BREACHED at 150 million monthly fans and the racing circuit is still shaking from the impact! Our trainer's month-long campaign will go down as one of the most dominant performances in recent racing history. The paddock analysts have run out of charts, the commentators have lost their voices, and the grandstand is still waving flags from the celebration that started three days ago. Every week was a masterclass in momentum building. Every race was a clinic in competitive excellence. And those 150 million fans? Each one a testament to a trainer who redefined what's possible in a single month. SUPER-COMPETITIVE — the tier where greatness becomes VISIBLE to the entire world! 🏆💫🔥`,
    `@everyone 🏆 History has been written in thundering hooves and blazing speed — our trainer just claimed SUPER-COMPETITIVE at 150 MILLION monthly fans! The monthly leaderboard didn't just get updated; it got TRANSFORMED by the sheer force of this achievement. Four weeks of relentless, strategic, absolutely awe-inspiring racing that left the competition gasping and the fans chanting your name in unison. The paddock has never seen a monthly campaign executed with such precision and passion. Every training drill was purposeful, every race day was legendary, and every single one of those 150 million fans represents a life touched by your racing spirit. SUPER-COMPETITIVE — the tier where legends stop being legends and start being MYTHS! 👑⚡🌟`,
    `@everyone 🌸 The monthly tally has reached a breathtaking 150 million and the SUPER-COMPETITIVE achievement belongs to our extraordinary trainer! The paddock is celebrating like the championship just ended because — in the monthly rankings — it absolutely did! You didn't just win the month; you DOMINATED it with a performance that will be referenced in training manuals for generations. From the first stride of week one to the victory gallop at month's end, every moment was proof that this trainer operates in a different dimension of racing excellence. The monthly leaderboard now has a name that shines brighter than all others. SUPER-COMPETITIVE tier — the racing world is YOUR stage now! 💫⚡👑`,
  ],
  legend: [
    `@everyone 👑 LEGEND! Two HUNDRED million fans in a single month and the Umamusume racing world has witnessed the birth of a MONTHLY DEITY! Our trainer has transcended competition, shattered every expectation, and ascended to a tier where the air is thin and only the greatest ever breathe. The paddock doesn't just applaud anymore — it worships. The monthly leaderboard has been renamed in your honor. Four weeks of racing that will be taught in academies, studied by analysts, and dreamed about by every young horse-girl who laces up their racing shoes. 200 million monthly fans isn't an achievement — it's a PHENOMENON, a MOVEMENT, a MONTHLY REVOLUTION led by the greatest trainer to ever grace the turf. LEGEND tier — where immortality is earned one monthly campaign at a time! 👑⚡💫`,
    `@everyone ⚡ TWO HUNDRED MILLION! The LEGEND tier has been claimed and the entire Umamusume universe is celebrating the most dominant monthly campaign in racing history! Our trainer didn't just win the month — they REDEFINED what a month could be. The paddock has erected statues, the grandstand has been renamed, and the monthly leaderboard? It now exists to measure everyone else's distance from your greatness. 200 million fans in thirty days means every single day averaged nearly 7 million new hearts — a pace so blistering it warps reality itself. The racing circuit has witnessed many great trainers, but monthly LEGENDS? They come once in a generation. And this generation is YOURS! 👑🔥🌟`,
    `@everyone 👑 The monthly results are in and they defy belief — TWO HUNDRED MILLION fans and the LEGEND tier has been ACHIEVED! Our trainer's month-long campaign will be remembered as the moment the racing world changed forever. The paddock is speechless, the grandstand is a sea of tears and cheers, and the monthly leaderboard has been permanently altered by the sheer gravitational force of this achievement. Every week was a masterpiece, every race a legacy moment, every fan gained a brick in the monument you've built to your own greatness. You haven't just competed this month — you've TRANSCENDED. LEGEND tier achieved — now and forever, your name will be spoken with the reverence reserved for racing IMMORTALS! 💫🏆👑`,
    `@everyone 🌟 All hail the monthly LEGEND! Two hundred million fans in a single month — a number so colossal it bends the very fabric of the racing universe! Our trainer has completed a campaign that will echo through the halls of Umamusume history for eternity. The paddock has declared a holiday in your name. The training grounds have become a pilgrimage site for aspiring racers. The monthly leaderboard? It simply reads "LEGEND" at the top now, with your name emblazoned in gold beneath it. 200 million monthly fans means you didn't just capture hearts — you captured the IMAGINATION of the entire racing world. This is the summit. This is the pinnacle. This is YOUR MONTH forever! 👑⚡💖`,
    `@everyone 👑 The LEGEND tier doors have swung open and our trainer has thundered through at TWO HUNDRED MILLION monthly fans — a feat so extraordinary that racing historians are rewriting their books in real time! Four weeks of unprecedented dominance, thirty days of relentless excellence, and a final tally that stands as a monument to what's possible when talent meets dedication on the grandest stage. The paddock whispers your name like a prayer now. The grandstand rises whenever your silks appear. The monthly leaderboard has become a shrine to your greatness. You are not just a LEGEND — you are THE legend, the benchmark, the standard against which all future monthly campaigns will be measured! 👑🔥💫`,
  ],
};

// ── Lightweight tier-separated cache ──

interface CacheEntry {
  data: string;
  timestamp: number;
}

class TierCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  public readonly tier: MonthlyTier;

  constructor(tier: MonthlyTier) {
    this.tier = tier;
  }

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() - entry.timestamp > CACHE_TTL) {
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
    for (const [k, entry] of this.store) {
      if (!k.startsWith(prefix)) continue;
      if (now - entry.timestamp > CACHE_TTL) {
        this.store.delete(k);
        continue;
      }
      results.push(k);
    }
    return results;
  }

  clear(): void { this.store.clear(); }

  get size(): number { return this.keys(`${this.tier}-`).length; }

  getStats() {
    const total = this.hits + this.misses;
    return {
      tier: this.tier, size: this.store.size, hits: this.hits,
      misses: this.misses, hitRate: total > 0 ? this.hits / total : 0,
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

// ── MonthlyAchievementService ─────────────────────────────

export class MonthlyAchievementService {
  private caches: Record<MonthlyTier, TierCache>;
  private primaryAI: AIService | null;
  private fallbackAI: AIService | null;
  private brainAI: AIService | null;
  private prompts: PromptLibrary;

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

    this.caches = {} as Record<MonthlyTier, TierCache>;
    for (const tier of ALL_TIERS) {
      this.caches[tier] = new TierCache(tier);
    }

    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode');
    logger.info(`MonthlyAchievementService initialized (${parts.join(', ')})`);
  }

  // ── Public API ──────────────────────────────────────────

  async generateMonthlyTop3(
    achievers: MonthlyAchiever[],
    serverName: string,
  ): Promise<string> {
    const achieverData = this.#formatAchieverData(achievers);

    if (this.primaryAI) {
      try {
        const msg = await this.#generateTop3ViaAI(this.primaryAI, achieverData, achievers, serverName);
        logger.info(`Monthly top 3 generated via primary (${achievers.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Monthly top 3 primary failed: ${err.message}. Trying fallback...`);
      }
    }

    if (this.fallbackAI) {
      try {
        const msg = await this.#generateTop3ViaAI(this.fallbackAI, achieverData, achievers, serverName);
        logger.info(`Monthly top 3 generated via fallback (${achievers.length} trainers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Monthly top 3 fallback failed: ${err.message}. Using bootstrap...`);
      }
    }

    return `@everyone 👑 The monthly tally period has officially concluded on ${serverName}, and the Umamusume turf belongs to our magnificent Top 3 monthly champions! What an incredible month-long campaign of relentless training, strategic pacing, and unwavering dedication. From the opening starting gates on the 1st to this glorious final stretch across the finish line, our podium stars (${achievers.map(a => `<@${a.discordUserId}> (${a.trainerName})`).join(', ')}) have left every competitor in awe. Your massive fan gains and tier achievements are a testament to true racing greatness. The grandstand is erupting in thunderous applause, the commentators are crowning your names in glory, and history's ink is written in your honor. Celebrate this monumental achievement together, champions — you earned every single fan! 🌟🏆🐎`;
  }

  async generateAchievementMessage(
    tier: MonthlyTier,
    trainerName: string,
    monthlyGain: number,
    serverName: string,
  ): Promise<string> {
    const cache = this.caches[tier];
    const prefix = `${tier}-`;
    const info = MONTHLY_TIERS[tier];

    if (this.primaryAI) {
      try {
        const msg = await this.#generateViaAI(this.primaryAI, info, trainerName, monthlyGain, serverName);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Monthly [${tier}] generated via primary for ${trainerName}`);
        return msg;
      } catch (err: any) {
        logger.warn(`Monthly [${tier}] primary failed: ${err.message}. Trying fallback...`);
      }
    }

    if (this.fallbackAI) {
      try {
        const msg = await this.#generateViaAI(this.fallbackAI, info, trainerName, monthlyGain, serverName);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Monthly [${tier}] generated via fallback for ${trainerName}`);
        return msg;
      } catch (err: any) {
        logger.warn(`Monthly [${tier}] fallback failed: ${err.message}. Going to cache...`);
      }
    }

    // Tier 3: Local brain (supervisor) retries once before cache
    if (this.brainAI) {
      try {
        const msg = await this.#generateViaAI(this.brainAI, info, trainerName, monthlyGain, serverName);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Monthly [${tier}] recovered by local brain for ${trainerName}`);
        return msg;
      } catch (err: any) {
        logger.warn(`Monthly [${tier}] brain recovery failed: ${err.message}. Going to cache...`);
      }
    }

    return this.#fallbackMonthly(tier);
  }

  getPoolSize(tier: MonthlyTier): number { return this.caches[tier].size; }

  getAllPoolSizes(): Record<MonthlyTier, number> {
    const result = {} as Record<MonthlyTier, number>;
    for (const tier of ALL_TIERS) result[tier] = this.caches[tier].size;
    return result;
  }

  clearTier(tier: MonthlyTier): void { this.caches[tier].clear(); }
  clearAll(): void { for (const t of ALL_TIERS) this.caches[t].clear(); }

  // ── Private ─────────────────────────────────────────────

  async #generateViaAI(
    ai: AIService, info: MonthlyTierInfo,
    trainerName: string, monthlyGain: number, serverName: string,
  ): Promise<string> {
    const rendered = this.prompts.render('monthly-achievement', {
      trainerName, monthlyGain: this.#format(monthlyGain),
      tierTitle: info.title, tierDescription: info.description, serverName,
    });
    if (!rendered) throw new Error('Prompt template "monthly-achievement" not found');

    const raw = await ai.generate({
      system: rendered.system,
      prompt: rendered.user
        .replaceAll('${trainerName}', trainerName)
        .replaceAll('${monthlyGain}', this.#format(monthlyGain))
        .replaceAll('${tierTitle}', info.title)
        .replaceAll('${tierDescription}', info.description)
        .replaceAll('${serverName}', serverName),
    });
    return this.#sanitize(raw);
  }

  #fallbackMonthly(tier: MonthlyTier): string {
    const cache = this.caches[tier];
    const pool = cache.keys(`${tier}-`);
    const info = MONTHLY_TIERS[tier];

    if (pool.length >= 2) {
      const shuffled = pool.sort(() => Math.random() - 0.5);
      for (const key of shuffled) {
        const msg = cache.get(key);
        if (msg) { logger.info(`Monthly [${tier}] fallback: random cache (${pool.length})`); return msg; }
      }
    }
    if (pool.length === 1) {
      const msg = cache.get(pool[0]);
      if (msg) { logger.info(`Monthly [${tier}] fallback: sole cached`); return msg; }
    }
    const bp = BOOTSTRAP_POOLS[tier];
    logger.warn(`Monthly [${tier}] fallback: bootstrap (${bp.length} ${info.title}-themed)`);
    return bp[Math.floor(Math.random() * bp.length)];
  }

  #format(n: number): string {
    if (n >= 1_000_000) { const m = n / 1_000_000; return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`; }
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
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

  async #generateTop3ViaAI(
    ai: AIService,
    achieverData: string,
    achievers: MonthlyAchiever[],
    serverName: string,
  ): Promise<string> {
    const rendered = this.prompts.render('monthly-achievement-top3', {
      achieverData,
      serverName,
      count: String(achievers.length),
    });

    if (!rendered) throw new Error('Prompt template "monthly-achievement-top3" not found');

    const raw = await ai.generate({
      system: rendered.system,
      prompt: rendered.user,
    });

    const sanitized = this.#sanitize(raw);
    this.#validateMentions(sanitized, achievers);
    return sanitized;
  }

  #formatAchieverData(achievers: MonthlyAchiever[]): string {
    const medals = ['🥇', '🥈', '🥉'];
    return achievers
      .map((a) => {
        const prefix = a.rank <= 3 ? medals[a.rank - 1] : `  ${a.rank}.`;
        const gain = this.#format(a.monthlyGain);
        const tierTag = a.tier && a.tier !== '-' ? ` [${a.tier}]` : '';
        return `  ${prefix} <@${a.discordUserId}> (${a.trainerName})${tierTag} — +${gain} fans this month`;
      })
      .join('\n');
  }

  #validateMentions(msg: string, achievers: MonthlyAchiever[]): void {
    const realIds = new Set(achievers.map(a => a.discordUserId));
    const plain = [...msg.matchAll(/@(?!\d{17,19}>)(\w+)/g)];
    if (plain.length > 0) {
      throw new Error(`Invented @mentions: ${plain.map(m => m[0]).join(', ')} — retrying`);
    }
    const ids = [...msg.matchAll(/<@(\d{17,19})>/g)].map(m => m[1]);
    const hallucinated = ids.filter(id => !realIds.has(id));
    if (hallucinated.length > 0) {
      throw new Error(`Unknown user IDs mentioned: ${hallucinated.join(', ')} — retrying`);
    }
  }
}
