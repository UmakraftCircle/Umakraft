import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from './index.js';
import type { PromptLibrary } from './prompts.js';

const logger = createLogger('DailyMessageService');

// ── Constants ──

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_CACHE_SIZE = 200; // per time slot
const MIN_WORDS = 100;
const MAX_WORDS = 150;

export type TimeSlot = 'morning' | 'noon' | 'evening' | 'midnight';

const TIME_SLOTS: TimeSlot[] = ['morning', 'noon', 'evening', 'midnight'];

const TIME_GUIDANCE: Record<TimeSlot, string> = {
  morning:  'energetic and motivational — talk about fresh starts, setting goals, and the exciting day ahead',
  noon:     'a midday check-in — ask how everyone is doing, remind them to take breaks and stay hydrated',
  evening:  'cozy and reflective — ask about their day, celebrate small wins, encourage unwinding',
  midnight: 'calm and comforting — speak to the night owls, remind them to rest soon, keep it gentle and warm',
};

// ── Bootstrap pools — 5 messages per time slot (20 total) ──
// Formatted as her quiet internal monologue reflecting on Trainer, followed by a composed spoken greeting.

const BOOTSTRAP_POOLS: Record<TimeSlot, string[]> = {
  morning: [
    `(The early morning track is still damp with dew. Trainer arrived before sunrise to inspect the turf and prepare today's stopwatch sheets. Seeing that steady devotion always reminds me why every lap counts.) @everyone 🌅 Good morning, everyone. The training grounds are quiet and the air is crisp. Please make sure to stretch properly, have a warm breakfast, and pace yourselves as the day begins. What goals are you setting for your routine today? Let us take each stride with calm focus.`,
    `(Trainer's clipboard is already filled with lap notes. Even when the morning breeze is chilly, Trainer never misses checking my stride and form. That quiet reliability gives me the confidence to step forward.) @everyone ☀️ Good morning. Another day of training begins on the track. Please remember that consistent, steady effort always brings results over time. Stay hydrated and don't rush through your morning preparations. How is everyone feeling as we start our morning laps today?`,
    `(I noticed Trainer adjusting the pacing cones along the bend early this morning. Trainer's care is always subtle, but it never goes unseen. I want to honor that effort on the track today.) @everyone 🍃 Good morning. The starting gates are open for a fresh day. Whether you have intense drills planned or light recovery, treat your body with patience and care. Have you taken a moment to breathe and prepare your focus? Let us support one another steadily.`,
    `(Dawn light is just breaking across the grandstand. Trainer was already reviewing our splits from yesterday, planning today's course with quiet diligence. It makes me want to run with even greater precision.) @everyone 🌸 Good morning. The track is ready and the morning sun is rising. Remember that every small improvement in your stride builds toward greater distances. Take your time, eat well, and let us approach today with steady composure.`,
    `(Seeing Trainer standing at the rail with stopwatch in hand always settles my racing heart. No loud speeches are needed—just Trainer's presence is enough to steady my focus.) @everyone ⭐ Good morning, everyone. A calm mind makes for the best preparation. Please take care of yourselves as the day opens up, and remember to pace your energy wisely. What is one small step you hope to accomplish this morning?`,
  ],
  noon: [
    `(Trainer has been at the desk analyzing race footage all morning without taking a proper pause. I should gently remind Trainer that resting between sessions is just as important as the drills themselves.) @everyone 🌤️ Good afternoon. Half of the day's training is behind us. Please step away from your work for a brief moment, drink some water, and allow your shoulders to relax. Consistency requires steady recovery. How has your morning gone so far?`,
    `(The midday sun is high over the paddock. Trainer has been checking times since dawn, likely forgetting to stop for lunch. I brought an extra tea to make sure Trainer refuels.) @everyone 🕐 Good afternoon, everyone. It is time for a quiet midday check-in. Whether your morning drills were demanding or smooth, give yourself permission to pause. Have you had a nourishing meal and stayed hydrated? Let us recharge our strength for the afternoon.`,
    `(Trainer's brow furrowed slightly over the mid-session reports. Even in the midday heat, Trainer remains dedicated to our schedule. I hope Trainer remembers that pacing matters.) @everyone 🌤️ Midday check-in. The midday heat can drain your stamina if you are not mindful. Please take a moment to rest your eyes, stretch your legs, and catch your breath. Taking a pause is a mark of a disciplined runner. How are you pacing your day?`,
    `(The track is quiet during the lunch bell. Trainer is still jotting down observations from our morning sprints. Seeing that quiet dedication makes me want to ensure Trainer takes care of their health.) @everyone 🍃 Good afternoon. We have reached the midpoint of the day. Remember to step away from the screen, take several slow breaths, and refresh your mind. A calm mind prepares us for the remaining course ahead.`,
    `(Trainer's focus never wavers, but even the best trainers need recovery. I made sure there is fresh water ready beside the clipboard.) @everyone ☀️ Good afternoon, everyone. Midday is the right time to assess our pace and adjust where needed. Please take time to nourish yourself and rest your mind before the afternoon sessions resume. What is one positive note from your morning?`,
  ],
  evening: [
    `(The sun is setting across the final straight, casting long shadows on the turf. Trainer is carefully wiping down the stopwatches and packing away the charts. Another long day of training safely completed.) @everyone 🌅 Good evening, everyone. The day's drills are concluding and the twilight air is cool. Please allow yourself to unwind, let go of any tension from the afternoon, and enjoy a warm dinner. How was your training session today?`,
    `(Trainer spent the entire afternoon observing our strides by the railing. The wind picked up, but Trainer stayed until the cool-down laps were finished. That quiet support means more than words.) @everyone 🌆 Good evening. As night settles over the grounds, it is time to transition from work into restful recovery. Be proud of the effort you put in today, no matter the distance covered. What is your favorite way to relax after a full day?`,
    `(Cooling down after the final lap. Trainer handed me a warm towel with a quiet nod of approval. That simple gesture is all the encouragement I need.) @everyone 🌄 Good evening. The course is quiet now and the lights along the grandstand are turning on. Take this time to reflect quietly, enjoy the company of friends, and recharge. Rest is an essential part of every runner's journey.`,
    `(Trainer is still reviewing the final split times in the office, but the day's physical demands are done. I should make sure Trainer doesn't stay too late tonight.) @everyone 🌙 Good evening, everyone. Twilight has arrived. Please set aside your daily stresses, put your feet up, and allow your body to heal. Every great race is built on proper evening recovery. What was the most meaningful part of your day?`,
    `(The turf is deserted now under the evening sky. Trainer walked the track one last time to ensure the footing was safe for tomorrow. Such constant, quiet care.) @everyone 🍂 Good evening. The day has come to a peaceful close. Settle into a comfortable space, breathe deeply, and take care of yourselves tonight. Let us share a calm moment together before the night deepens.`,
  ],
  midnight: [
    `(The track is completely dark and still under the stars. I hope Trainer is already asleep and not staying up late revising training schedules again. Resting well is crucial for tomorrow's performance.) @everyone 🌙 Good midnight to those still awake. The grounds are silent and peaceful now. While late hours offer quiet solitude, please do not neglect your rest. Tomorrow will ask for your energy, so make sure to get some sleep soon.`,
    `(Looking out across the quiet stables. Trainer works so hard for our sake every single day—I only hope Trainer is resting comfortably tonight without worrying about tomorrow's times.) @everyone 🌌 Midnight check-in. To the night owls still present, I hope your evening has been calm and gentle. Please remember to hydrate and let your eyes rest from the screen. A good night's sleep is the best foundation for any runner.`,
    `(The clock tower bells echo faintly across the silent academy. Trainer often forgets how late it gets when lost in tactical plans. I must watch over Trainer's wellbeing.) @everyone 🦉 Midnight has arrived. The world is quiet, and this is a time for stillness. If you are still awake working or reflecting, please treat yourself with kindness and prepare for sleep soon. We will be here when the morning light returns.`,
    `(A soft night breeze passes through the trees near the track. Knowing Trainer will be there again at dawn brings a quiet warmth to my heart, but right now, sleep must come first.) @everyone 🌠 Good midnight, everyone. For those keeping quiet company in the server at this hour, remember that your health and rest always come first. Rest well, and let your body recover for the journey ahead.`,
    `(The paddock is motionless under the moonlight. Trainer's quiet faith in me is what keeps me grounded. I will do my best tomorrow, but tonight is for quiet rest.) @everyone 🌙 Midnight greetings. The quietest hours are here. Please take care of yourself, wrap up whatever you are doing, and allow yourself a peaceful, restorative rest. Good night to everyone.`,
  ],
};

// ── Lightweight cache (same as GreetingService, but time-slot-aware) ──

interface CacheEntry {
  data: string;
  timestamp: number;
}

class SlotCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  public readonly slot: TimeSlot;

  constructor(slot: TimeSlot) {
    this.slot = slot;
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
      if (now - entry.timestamp > CACHE_TTL) { this.store.delete(k); continue; }
      results.push(k);
    }
    return results;
  }

  get size(): number {
    // Recalculate size by iterating and cleaning expired entries
    const now = Date.now();
    let count = 0;
    for (const [k, entry] of this.store) {
      if (now - entry.timestamp > CACHE_TTL) { this.store.delete(k); continue; }
      count++;
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  getStats() {
    return { hits: this.hits, misses: this.misses, evictions: this.evictions };
  }

  private evictOldest(): void {
    let oldestK: string | null = null;
    let oldestT = Infinity;
    for (const [k, entry] of this.store) {
      if (entry.timestamp < oldestT) {
        oldestT = entry.timestamp;
        oldestK = k;
      }
    }
    if (oldestK) {
      this.store.delete(oldestK);
      this.evictions++;
    }
  }
}

// ── Bootstrapper label helper ──

function bootstrapPoolLabel(slot: TimeSlot): string {
  const pools = BOOTSTRAP_POOLS[slot];
  return `${pools.length} pre-written ${slot} messages`;
}

// ── DailyMessageService ──────────────────────────────────

export class DailyMessageService {
  private caches: Record<TimeSlot, SlotCache>;
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
    this.caches = {
      morning:  new SlotCache('morning'),
      noon:     new SlotCache('noon'),
      evening:  new SlotCache('evening'),
      midnight: new SlotCache('midnight'),
    };

    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode');
    logger.info(`DailyMessageService initialized (${parts.join(', ')})`);
  }

  // ── Public API ──────────────────────────────────────────

  /**
   * Generate a daily message for the given time slot.
   * 5-tier fallback: primary → fallback → random cache → sole cache → bootstrap
   */
  async generateDailyMessage(
    timeSlot: TimeSlot,
    serverName: string,
    memberCount: number,
  ): Promise<string> {
    const cache = this.caches[timeSlot];
    const prefix = `${timeSlot}-`;

    // Tier 1: Primary
    if (this.primaryAI) {
      try {
        const msg = await this.#generateViaAI(this.primaryAI, timeSlot, serverName, memberCount);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Daily [${timeSlot}] generated via primary (${this.primaryAI.getCurrentModel()})`);
        return msg;
      } catch (err: any) {
        logger.warn(`Daily [${timeSlot}] primary failed: ${err.message}. Trying fallback...`);
      }
    }

    // Tier 2: Fallback model
    if (this.fallbackAI) {
      try {
        const msg = await this.#generateViaAI(this.fallbackAI, timeSlot, serverName, memberCount);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Daily [${timeSlot}] generated via fallback (${this.fallbackAI.getCurrentModel()})`);
        return msg;
      } catch (err: any) {
        logger.warn(`Daily [${timeSlot}] fallback failed: ${err.message}. Going to cache...`);
      }
    }

    // Tier 3: Local brain (supervisor) retries once before cache
    if (this.brainAI) {
      try {
        const msg = await this.#generateViaAI(this.brainAI, timeSlot, serverName, memberCount);
        cache.set(`${prefix}${Date.now()}`, msg);
        logger.info(`Daily [${timeSlot}] recovered by local brain (${this.brainAI.getCurrentModel()})`);
        return msg;
      } catch (err: any) {
        logger.warn(`Daily [${timeSlot}] brain recovery failed: ${err.message}. Going to cache...`);
      }
    }

    // Tiers 4-5: Cache → Sole → Bootstrap (time-slot-isolated)
    return this.#fallbackDaily(timeSlot);
  }

  /** Number of cached messages for a specific time slot. */
  getPoolSize(slot: TimeSlot): number {
    return this.caches[slot].size;
  }

  /** Get all pool sizes at once. */
  getAllPoolSizes(): Record<TimeSlot, number> {
    return {
      morning:  this.caches.morning.size,
      noon:     this.caches.noon.size,
      evening:  this.caches.evening.size,
      midnight: this.caches.midnight.size,
    };
  }

  clear(): void {
    for (const slot of TIME_SLOTS) this.caches[slot].clear();
  }

  clearSlot(slot: TimeSlot): void {
    this.caches[slot].clear();
  }

  // ── Private ─────────────────────────────────────────────

  async #generateViaAI(
    ai: AIService,
    timeSlot: TimeSlot,
    serverName: string,
    memberCount: number,
  ): Promise<string> {
    const rendered = this.prompts.render('daily-message', {
      timeOfDay: timeSlot,
      serverName,
      memberCount: String(memberCount),
      timeGuidance: TIME_GUIDANCE[timeSlot],
    });

    if (!rendered) {
      throw new Error('Prompt template "daily-message" not found');
    }

    const raw = await ai.generate({
      system: rendered.system.replaceAll('${timeOfDay}', timeSlot),
      prompt: rendered.user,
    });

    return this.#sanitize(raw);
  }

  #fallbackDaily(timeSlot: TimeSlot): string {
    const cache = this.caches[timeSlot];
    const prefix = `${timeSlot}-`;
    const pool = cache.keys(prefix);
    const poolLabel = bootstrapPoolLabel(timeSlot);

    if (pool.length >= 2) {
      const shuffled = pool.sort(() => Math.random() - 0.5);
      for (const key of shuffled) {
        const msg = cache.get(key);
        if (msg) {
          logger.info(`Daily [${timeSlot}] fallback: random cache (pool: ${pool.length})`);
          return msg;
        }
      }
    }

    if (pool.length === 1) {
      const msg = cache.get(pool[0]);
      if (msg) {
        logger.info(`Daily [${timeSlot}] fallback: sole cached`);
        return msg;
      }
    }

    logger.warn(`Daily [${timeSlot}] fallback: bootstrap (${poolLabel})`);
    const bootstrap = BOOTSTRAP_POOLS[timeSlot];
    return bootstrap[Math.floor(Math.random() * bootstrap.length)];
  }

  #sanitize(raw: string): string {
    let msg = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'"))) {
      msg = msg.slice(1, -1).trim();
    }
    if (!msg.includes('@everyone')) msg = `@everyone ${msg}`;
    const words = msg.split(/\s+/);
    if (words.length < MIN_WORDS) throw new Error('AI response too short');
    if (words.length > MAX_WORDS) msg = words.slice(0, MAX_WORDS).join(' ') + ' 🔥';
    return msg;
  }
}
