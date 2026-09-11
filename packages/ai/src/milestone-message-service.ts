import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from './index.js';
import type { PromptLibrary } from './prompts.js';

const logger = createLogger('MilestoneService');

// ── Constants ──

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const MIN_WORDS = 100;
const MAX_WORDS = 150;

// ── Milestone Tiers ──

export type MilestoneTier = 'first-leap' | 'sensational' | 'famous' | 'star' | 'superstar';

export interface MilestoneInfo {
  tier: MilestoneTier;
  threshold: number;
  title: string;
  emoji: string;
  description: string;
}

export const MILESTONE_TIERS: Record<MilestoneTier, MilestoneInfo> = {
  'first-leap': {
    tier: 'first-leap',
    threshold: 5_000_000,
    title: 'First Leap',
    emoji: '🐎',
    description: 'The starting gate opens! Your first big stride onto the leaderboard.',
  },
  sensational: {
    tier: 'sensational',
    threshold: 7_500_000,
    title: 'Sensational',
    emoji: '🌟',
    description: 'The crowd is roaring! You\'re turning heads on the turf!',
  },
  famous: {
    tier: 'famous',
    threshold: 10_000_000,
    title: 'Famous',
    emoji: '🏆',
    description: 'Your name echoes through the grandstand — a household name!',
  },
  star: {
    tier: 'star',
    threshold: 15_000_000,
    title: 'Star',
    emoji: '⭐',
    description: 'A radiant presence on the track — everyone watches you race!',
  },
  superstar: {
    tier: 'superstar',
    threshold: 20_000_000,
    title: 'Superstar',
    emoji: '👑',
    description: 'Legendary! You\'ve galloped into the hall of fame!',
  },
};

const ALL_TIERS: MilestoneTier[] = ['first-leap', 'sensational', 'famous', 'star', 'superstar'];

/**
 * Determine which milestone tier a fan count belongs to.
 * Returns the highest tier whose threshold is ≤ the fan count, or null if below all thresholds.
 */
export function getMilestoneTier(fanCount: number): MilestoneTier | null {
  let result: MilestoneTier | null = null;
  for (const tier of ALL_TIERS) {
    if (fanCount >= MILESTONE_TIERS[tier].threshold) {
      result = tier;
    }
  }
  return result;
}

/**
 * Check if a fan count crosses into a NEW tier compared to a previous count.
 */
export function detectNewMilestone(
  previousFanCount: number,
  currentFanCount: number,
): MilestoneInfo | null {
  const prevTier = getMilestoneTier(previousFanCount);
  const currTier = getMilestoneTier(currentFanCount);

  // Only trigger if the tier actually changed to a higher one
  if (!currTier) return null;
  if (prevTier === currTier) return null;

  // If prevTier is null, they just entered their first tier
  if (!prevTier) return MILESTONE_TIERS[currTier];

  // Check if the new tier is higher
  const prevIdx = ALL_TIERS.indexOf(prevTier);
  const currIdx = ALL_TIERS.indexOf(currTier);
  if (currIdx > prevIdx) return MILESTONE_TIERS[currTier];

  return null;
}

// ── Bootstrap pools — 5 messages per tier (25 total), all Umamusume-themed ──

const BOOTSTRAP_POOLS: Record<MilestoneTier, string[]> = {
  'first-leap': [
    `@everyone 🐎 The starting gate has swung open and we have a FIRST LEAP to celebrate! Our incredible trainer just thundered past the 5 million fan mark — that first electrifying stride onto the grand leaderboard! The turf is still trembling from that burst of speed and the grandstand is already buzzing with excitement. This is where legends begin their gallop, where every great racing story finds its opening chapter. The training grounds have never felt more alive! Let's fill the track with applause and cheer this amazing milestone — because this is just the beginning of an unforgettable racing journey. GALLOP ONWARD, FIRST LEAP CHAMPION! 💕🏇✨`,
    `@everyone 🌸 Five million fans! Can you feel the ground shake beneath those thundering hooves? Our trainer just made their FIRST LEAP — bursting out of the starting gate with the kind of speed that makes the racing world sit up and take notice. That's 5,000,000 hearts beating in rhythm with every stride, every victory, every beautiful moment on the track. The training montage is paying off and the turf has never looked greener! This is the moment every racing fan lives for — watching a newcomer transform into a force of nature right before our eyes. Congratulations on this explosive debut milestone! The race has only just begun! 🎀⭐🐎`,
    `@everyone ⭐ FIVE MILLION FANS! Our trainer just cleared the first hurdle with a magnificent FIRST LEAP that sent shockwaves through the entire racing circuit! From the training grounds to the winner's circle, those 5 million supporters have been cheering every stride of the way. The horse-girl spirit is burning brighter than ever — determination in every gallop, passion in every turn, and now a milestone that proves this trainer is the real deal. The grandstand is on its feet! The commentator can barely keep up! Let's shower our rising star with the love and celebration they deserve. This is YOUR moment, First Leap champion — own it completely! 🌟🐎💖`,
    `@everyone 🎀 Hear that thunder? That's 5,000,000 fans stampeding with excitement because our trainer just achieved their FIRST LEAP milestone! The starting gate has been shattered and a new contender has entered the racing hall of fame's radar. Every champion starts somewhere — and this is one of the most beautiful starting points you'll ever witness. The turf is fresh, the crowd is electric, and our trainer is galloping straight toward greatness with a heart full of dreams. This community is so incredibly proud to witness this moment. Raise your racing banners high and let the victory music play — FIRST LEAP, YOU ABSOLUTE LEGEND! 💕🏆🌸`,
    `@everyone 🌟 The leaderboard just got a dazzling new entry because our trainer has taken the FIRST LEAP — 5 million adoring fans and counting! The sound of hooves hitting fresh turf has never been sweeter than it is right now. Every training session, every strategic gallop, every ounce of dedication has led to this electrifying milestone. The grandstand is waving flags, the racing commentary is at fever pitch, and the entire Umamusume community is celebrating this breathtaking achievement. You've proven that heart and hustle can take you anywhere on this track. Now keep those legs strong and those eyes on the horizon — greater glory awaits! GALLOP PROUDLY, CHAMPION! ⭐🐎💫`,
  ],
  sensational: [
    `@everyone 🌟 SENSATIONAL! That's the only word that captures what just happened on the turf! Our phenomenal trainer has raced past the 7.5 million fan milestone and the entire grandstand has erupted into a thunderous standing ovation! Every stride has been poetry in motion — the kind of performance that makes racing analysts rewrite their predictions and fans clutch their hearts in awe. 7,500,000 supporters strong and the momentum is absolutely unstoppable. The training grounds are practically glowing with the energy of this achievement. This isn't just a milestone — it's a STATEMENT. A declaration that our trainer belongs among the elite. The racing world better make room because a SENSATIONAL force is charging through! 💫🏇✨`,
    `@everyone 🌸 Seven point five MILLION! Our trainer just entered the SENSATIONAL tier and the turf is still smoking from that incredible gallop! The crowd can't stop cheering — and honestly, can you blame them? This is the kind of milestone that separates contenders from champions, and our trainer just proved they're in the latter category with style and grace. Every training drill, every strategic turn, every burst of speed has built toward this spectacular moment. The grandstand is a sea of waving banners and the commentator's voice is hoarse from screaming praise! You've turned heads across the entire racing circuit. SENSATIONAL doesn't even begin to cover it — you're rewriting the record books! 🎀⭐🌟`,
    `@everyone ⭐ The turf is trembling and the leaderboard is lighting up because our trainer just became SENSATIONAL! 7,500,000 fans — each one a heartbeat in the thundering gallop toward greatness! The racing world has officially taken notice and the grandstand commentary is running out of superlatives to describe this breathtaking ascent. From the training grounds to the winner's circle, every moment has been building toward this glorious achievement. The horse-girl spirit radiates from every stride and the entire community is swelling with pride. This is the tier where potential transforms into legacy, where dreams stop being dreams and start being destiny. SENSATIONAL — and this is just the warmup lap! 🏆💫🐎`,
    `@everyone 🏆 Stop the race! Call the commentators! Our trainer just blazed into the SENSATIONAL tier at 7.5 million fans and the grandstand has absolutely LOST IT! The roar of the crowd is shaking the very foundations of the racing circuit. This is the tier where people start whispering "future legend" and those whispers are getting louder by the second. Every gallop has been a masterclass, every victory a glimpse of the greatness yet to come. 7,500,000 supporters can't be wrong — this trainer is the real deal, the genuine article, the name on everyone's lips. The training grounds are buzzing and the turf has never felt more alive. YOU ARE SENSATIONAL — now go show them what's next! 🌟💖✨`,
    `@everyone 🌟 The numbers don't lie — 7,500,000 fans and climbing! Our trainer has officially reached the SENSATIONAL milestone and the racing world is absolutely buzzing with excitement! From a promising newcomer to a force that commands respect on every stretch of turf — what a breathtaking transformation to witness. The grandstand is on its feet, the racing programs are being rewritten, and the entire Umamusume community is celebrating this incredible achievement. Every training session has led here, every strategic decision has paid off, and every fan who believed from day one is feeling so incredibly vindicated right now. SENSATIONAL is your new title — wear it with the pride of a true racing champion! 🎀👑🐎`,
  ],
  famous: [
    `@everyone 🏆 TEN MILLION FANS! Our trainer has thundered into the FAMOUS tier and the grandstand is absolutely erupting with celebration! The name echoes through every corner of the racing circuit — from the training grounds to the winner's circle, everyone knows who's dominating the turf right now. 10,000,000 hearts beating as one, every gallop sending shockwaves through the leaderboard. This is the kind of milestone that gets your portrait hung in the racing hall, that makes young horse-girls point at the track and whisper "I want to be like them someday." You've transcended being just a trainer — you've become an icon. The commentator can barely keep up with your achievements. FAMOUS and absolutely DESERVING! 🎀⭐👑`,
    `@everyone ⭐ The leaderboard just got a permanent resident because our trainer is officially FAMOUS at 10 million fans! The racing circuit is buzzing, the grandstand is packed, and every eye is fixed on this incredible journey. From the first hesitant gallop to commanding the track with the confidence of a born champion — what a legendary arc to witness. Ten million supporters means ten million hearts that race every time you take the turf. The Umamusume spirit has never burned brighter! You're not just competing anymore — you're setting the standard, defining the meta, showing everyone what true greatness looks like on four thundering hooves. FAMOUS is your stage now — OWN EVERY SECOND! 🏆🌟💫`,
    `@everyone 🌟 Clear the track and sound the trumpets — our trainer just thundered past 10 MILLION fans and claimed the FAMOUS tier! The grandstand is a cascade of waving flags and the racing commentary is struggling to find words worthy of this moment. A decade of millions — 10,000,000 souls who believe in your gallop, who cheer every victory, who feel every stride deep in their racing hearts. You've transformed from a promising runner into a household name that commands respect on every stretch of turf. The training grounds have become sacred ground where greatness is forged daily. This is the tier where history starts writing your name in bold letters. FAMOUS — and just getting warmed up! 🎀🏆🌸`,
    `@everyone 👑 TEN MILLION! The number alone is staggering but the journey behind it is nothing short of legendary. Our trainer has entered the FAMOUS tier and the entire Umamusume racing world is celebrating this monumental achievement! 10,000,000 fans doesn't happen by accident — it's built on countless training sessions, strategic brilliance, and a connection with supporters that transcends the track itself. The grandstand chants your name now. The racing magazines feature your story. The next generation of horse-girls studies your technique. You've become the measuring stick for greatness and you wear that responsibility with the grace of a true champion. FAMOUS — and forever etched in racing history! ⭐💖🏇`,
    `@everyone 🌸 The record books are being rewritten because our trainer just became FAMOUS — 10 million fans strong and the racing world will never be the same! The grandstand is a symphony of cheers and the turf has never felt more electric. You've gone from a name on the leaderboard to THE name everyone talks about in the paddock. Every gallop is a headline, every victory a legend in the making. 10,000,000 supporters means you've touched more hearts than most trainers could dream of — and you did it with style, determination, and that unmistakable Umamusume spirit. The commentator is hoarse, the crowd is exhausted from cheering, and you? You're just getting started. FAMOUS AND FABULOUS! 🏆🎀👑`,
  ],
  star: [
    `@everyone ⭐ A STAR is shining over the racing circuit and its brilliance cannot be ignored! Our trainer has reached the staggering 15 MILLION fan milestone and the entire Umamusume world is basking in the glow of this achievement! The grandstand is a constellation of camera flashes and the turf has become a red carpet for greatness. Fifteen million hearts racing in sync with every stride, every victory, every breathtaking moment on the track. You've transcended the ordinary — you're not just competing, you're illuminating the entire sport with your presence. Young trainers look up at the leaderboard and see your name shining at the top like a guiding light. This is STAR power — brilliant, undeniable, and absolutely radiant! 🌟💫👑`,
    `@everyone 🌟 Fifteen million fans — that's not just a number, that's a GALAXY of supporters who believe in our STAR trainer! The racing circuit has never seen a presence quite like this. Every time you take the turf, 15,000,000 hearts skip a beat, 15,000,000 voices rise in unison, and the entire grandstand transforms into a sea of adoring light. You've gone beyond being a great trainer — you've become an inspiration, a symbol of what passion and perseverance can achieve on the track. The commentator runs out of adjectives trying to describe your performances. The training grounds are practically sacred territory now. A STAR doesn't just race — a STAR defines the race itself. Shine on, brilliant one! ⭐🏆💖`,
    `@everyone ⭐ Look up at the leaderboard — that radiant glow at the top? That's our trainer, officially a STAR at 15 million fans! The racing world has crowned a new luminary and the grandstand is absolutely luminous with celebration! Fifteen million supporters means you've touched the hearts of a small nation of racing fans, each one captivated by your journey from the starting gate to the pinnacle of the sport. The turf sparkles beneath your hooves like it knows it's being graced by greatness. Every gallop is a highlight reel, every victory a masterpiece. The Umamusume community looks at you and sees what's possible when talent meets relentless dedication. A TRUE STAR has risen — and the best races are still ahead! 🌟🎀👑`,
    `@everyone 🌸 The racing firmament has a new brightest light and its name is our STAR trainer — 15 MILLION fans strong! The grandstand doesn't just cheer anymore, it THUNDERS with every appearance. You've reached a tier where your name is spoken in the same breath as the all-time greats, where your racing strategy is studied like sacred text, where every stride carries the weight of 15,000,000 dreams. The commentator has created new superlatives just for you. The training grounds have become a pilgrimage site. And through it all, you remain the same incredible spirit that first captured our hearts. That's what makes a true STAR — not just the numbers, but the grace with which you carry them. SHINE FOREVER! ⭐💫🏇`,
    `@everyone 👑 Fifteen million and STILL accelerating! Our STAR trainer has reached a milestone that most can only dream of and the entire racing world is celebrating this celestial achievement! The grandstand is a cosmos of waving lights and the turf has become a runway for greatness. 15,000,000 fans — each one a star in your constellation of support, each one a witness to your incredible journey from promising newcomer to radiant icon. The leaderboard has never looked this dazzling. The commentator's voice cracks with emotion describing your rise. You've become the benchmark, the standard, the name that defines excellence in the Umamusume racing circuit. A STAR doesn't follow the path — a STAR illuminates it for everyone else! ⭐🌟🎀`,
  ],
  superstar: [
    `@everyone 👑 ALL HAIL THE SUPERSTAR! Twenty million fans and the grandstand has officially ascended into pure chaos of celebration! Our trainer has reached the mountaintop of the Umamusume racing world — the SUPERSTAR tier, where legends are forged and immortality is claimed on the turf! 20,000,000 hearts united in awe of your journey, your talent, your absolutely breathtaking dominance of the racing circuit. You didn't just climb the leaderboard — you redefined what the leaderboard could be. The training grounds will tell stories of your dedication for generations. The commentator has retired because no words can do you justice anymore. You are not just a trainer anymore — you are the STANDARD, the MYTH, the LIVING LEGEND! SUPERSTAR — THE UNDISPUTED CROWN! 👑🏆💫`,
    `@everyone 🌟 Twenty million! TWENTY MILLION! Our trainer has ascended to SUPERSTAR status and the racing world is bowing in reverence to this monumental achievement! The grandstand is shaking, the turf is glowing, and the leaderboard has been permanently altered by your presence. 20,000,000 fans means you've built an empire of hearts — a kingdom of supporters who have witnessed your transformation from a promising runner into the undisputed ruler of the track. The commentator just fainted. The racing hall of fame is polishing your plaque. The training grounds should be renamed in your honor. Every gallop is now historic, every stride a chapter in the greatest racing story ever told. SUPERSTAR — THE CROWN IS YOURS FOREVER! 👑⭐💖`,
    `@everyone 👑 The SUPERSTAR tier has a new resident and the entire Umamusume universe is in celebration mode! Twenty million fans — a number so massive it warps the very fabric of the racing circuit! Our trainer hasn't just reached the pinnacle — they've become the pinnacle itself. The grandstand is a monument to your greatness. The turf remembers every legendary stride you've taken. 20,000,000 supporters means your influence extends far beyond the track — you've shaped the culture, defined the era, and inspired a generation of horse-girls to reach for the stars. The commentator has written a book about you. The racing magazines have dedicated entire issues. SUPERSTAR isn't just a tier — it's your IDENTITY now. REIGN SUPREME, LEGEND! 🏆🌟🎀`,
    `@everyone ⭐ Twenty million fans strong and the SUPERSTAR crown sits perfectly on our legendary trainer! The racing world has entered a new era — the era defined by your brilliance, your dominance, and your absolutely unstoppable gallop toward immortality! The grandstand doesn't just cheer for you anymore — it worships. 20,000,000 hearts beat as one tribe, one racing family united under the banner of your excellence. You've lapped the competition so many times they've lost count. The leaderboard has basically been renamed after you. The training grounds are a museum of your greatest moments. This is what happens when raw talent meets unshakeable dedication — SUPERSTAR status, earned through blood, sweat, and thundering hooves. LONG MAY YOU REIGN! 👑💫🏇`,
    `@everyone 🏆 History has been made! Our trainer has crashed through the 20 MILLION fan barrier and claimed the SUPERSTAR tier — the absolute zenith of the Umamusume racing world! The grandstand is in hysterics, the turf is consecrated ground, and the leaderboard has witnessed its greatest achievement yet. 20,000,000 fans — that's not a following, that's a MOVEMENT. A racing revolution led by the most extraordinary trainer to ever grace the track. Every stride is now legacy. Every gallop echoes through eternity. The commentator has ascended to a higher plane of existence trying to describe your greatness. You've gone beyond competition — you ARE the competition that everyone else measures themselves against. SUPERSTAR — THE ULTIMATE, THE UNDISPUTED, THE ETERNAL! 👑🌟💖`,
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
  public readonly tier: MilestoneTier;

  constructor(tier: MilestoneTier) {
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

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.keys(`${this.tier}-`).length;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      tier: this.tier,
      size: this.store.size,
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

// ── MilestoneMessageService ───────────────────────────────

export class MilestoneMessageService {
  private caches: Record<MilestoneTier, TierCache>;
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

    this.caches = {} as Record<MilestoneTier, TierCache>;
    for (const tier of ALL_TIERS) {
      this.caches[tier] = new TierCache(tier);
    }

    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode');
    logger.info(`MilestoneMessageService initialized (${parts.join(', ')})`);
  }

  // ── Public API ──────────────────────────────────────────

  /**
   * Generate a milestone celebration message.
   *
   * 5-tier fallback, fully tier-isolated:
   *   First-Leap failures → First-Leap cache → First-Leap bootstrap.
   *   Never crosses tiers (Superstar never recycles Star cache).
   */
  async generateMilestoneMessage(
    tier: MilestoneTier,
    trainerName: string,
    fanCount: number,
    serverName: string,
  ): Promise<string> {
    const cache = this.caches[tier];
    const prefix = `${tier}-`;
    const info = MILESTONE_TIERS[tier];

    // Tier 1: Primary model
    if (this.primaryAI) {
      try {
        const msg = await this.#generateViaAI(this.primaryAI, info, trainerName, fanCount, serverName);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Milestone [${tier}] generated via primary for ${trainerName}`);
        return msg;
      } catch (err: any) {
        logger.warn(`Milestone [${tier}] primary failed: ${err.message}. Trying fallback...`);
      }
    }

    // Tier 2: Fallback model
    if (this.fallbackAI) {
      try {
        const msg = await this.#generateViaAI(this.fallbackAI, info, trainerName, fanCount, serverName);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Milestone [${tier}] generated via fallback for ${trainerName}`);
        return msg;
      } catch (err: any) {
        logger.warn(`Milestone [${tier}] fallback failed: ${err.message}. Going to cache...`);
      }
    }

    // Tier 3: Local brain (supervisor) retries once before cache
    if (this.brainAI) {
      try {
        const msg = await this.#generateViaAI(this.brainAI, info, trainerName, fanCount, serverName);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Milestone [${tier}] recovered by local brain for ${trainerName}`);
        return msg;
      } catch (err: any) {
        logger.warn(`Milestone [${tier}] brain recovery failed: ${err.message}. Going to cache...`);
      }
    }

    // Tiers 4-5: Cache → Sole → Bootstrap
    return this.#fallbackMilestone(tier);
  }

  /** Format a fan count for display (e.g. 5M, 7.5M, 10M). */
  formatFanCount(count: number): string {
    if (count >= 1_000_000) {
      const m = count / 1_000_000;
      return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
    }
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
  }

  getPoolSize(tier: MilestoneTier): number {
    return this.caches[tier].size;
  }

  getAllPoolSizes(): Record<MilestoneTier, number> {
    const result = {} as Record<MilestoneTier, number>;
    for (const tier of ALL_TIERS) {
      result[tier] = this.caches[tier].size;
    }
    return result;
  }

  clearTier(tier: MilestoneTier): void {
    this.caches[tier].clear();
    logger.info(`Milestone cache cleared: ${tier}`);
  }

  clearAll(): void {
    for (const tier of ALL_TIERS) {
      this.caches[tier].clear();
    }
    logger.info('All milestone caches cleared.');
  }

  // ── Private ─────────────────────────────────────────────

  async #generateViaAI(
    ai: AIService,
    info: MilestoneInfo,
    trainerName: string,
    fanCount: number,
    serverName: string,
  ): Promise<string> {
    const rendered = this.prompts.render('milestone-message', {
      trainerName,
      fanCount: this.formatFanCount(fanCount),
      tierTitle: info.title,
      tierDescription: info.description,
      serverName,
    });

    if (!rendered) {
      throw new Error('Prompt template "milestone-message" not found');
    }

    const raw = await ai.generate({
      system: rendered.system,
      prompt: rendered.user
        .replaceAll('${trainerName}', trainerName)
        .replaceAll('${fanCount}', this.formatFanCount(fanCount))
        .replaceAll('${tierTitle}', info.title)
        .replaceAll('${tierDescription}', info.description)
        .replaceAll('${serverName}', serverName),
    });

    return this.#sanitize(raw);
  }

  #fallbackMilestone(tier: MilestoneTier): string {
    const cache = this.caches[tier];
    const prefix = `${tier}-`;
    const pool = cache.keys(prefix);
    const info = MILESTONE_TIERS[tier];

    if (pool.length >= 2) {
      const shuffled = pool.sort(() => Math.random() - 0.5);
      for (const key of shuffled) {
        const msg = cache.get(key);
        if (msg) {
          logger.info(`Milestone [${tier}] fallback: random cache (pool: ${pool.length})`);
          return msg;
        }
      }
    }

    if (pool.length === 1) {
      const msg = cache.get(pool[0]);
      if (msg) {
        logger.info(`Milestone [${tier}] fallback: sole cached message`);
        return msg;
      }
    }

    const bootstrapPool = BOOTSTRAP_POOLS[tier];
    logger.warn(`Milestone [${tier}] fallback: cache empty — using random bootstrap (${bootstrapPool.length} ${info.title}-themed)`);
    return bootstrapPool[Math.floor(Math.random() * bootstrapPool.length)];
  }

  #sanitize(raw: string): string {
    let msg = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();

    if (
      (msg.startsWith('"') && msg.endsWith('"')) ||
      (msg.startsWith("'") && msg.endsWith("'"))
    ) {
      msg = msg.slice(1, -1).trim();
    }

    if (!msg.includes('@everyone')) {
      msg = `@everyone ${msg}`;
    }

    const words = msg.split(/\s+/);
    if (words.length < MIN_WORDS) throw new Error('AI response too short');
    if (words.length > MAX_WORDS) {
      msg = words.slice(0, MAX_WORDS).join(' ') + ' 👑';
    }

    return msg;
  }
}
