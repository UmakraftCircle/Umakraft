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
// Each pool is themed to its time of day — morning never recycles evening, etc.

const BOOTSTRAP_POOLS: Record<TimeSlot, string[]> = {
  morning: [
    `@everyone ☀️ Rise and shine, everyone! A brand new day is here and it's absolutely bursting with possibilities! Take a deep breath, stretch those arms, and get ready to make today amazing. Whether you're grinding levels, chasing goals, or just soaking in the good vibes — today is yours to conquer. Remember to fuel up with a good breakfast and stay hydrated throughout the morning. What's one thing you're excited to accomplish today? Let's start this day with positive energy and make some unforgettable memories together! Wishing you all a bright and beautiful morning! 💕✨`,
    `@everyone 🌸 Good morning, wonderful community! The sun is up, the server is buzzing, and another adventure-filled day awaits us all. Take a moment to appreciate the fresh start — yesterday is behind you and today is a blank canvas just waiting for your colors. Whether you're tackling big projects or enjoying small moments, every step forward counts. I hope your morning coffee is warm, your vibes are immaculate, and your heart is full of excitement for what's ahead. What's your morning ritual that gets you ready to slay the day? Let's share and inspire each other! 🌟💖`,
    `@everyone ⭐ Morning, lovely people! The world just hit the refresh button and so can you! Today is a gift wrapped in sunshine and sealed with endless opportunities. Don't forget to take a moment for yourself before diving into the chaos — a little self-care goes a long way. I'm sending each of you a virtual high-five and all the good energy you need to make today extraordinary. Remember: you've got this, and the whole community is cheering you on! What's one song that always gets you pumped up in the morning? Drop it below! 🎀🎶`,
    `@everyone 🌅 Good morning, Umakraft family! Can you feel that? It's the energy of a brand new day calling your name! Every sunrise is a reminder that you get another chance to chase your dreams, connect with amazing people, and create something beautiful. Don't let the morning rush steal your peace — pause, breathe, and set an intention for the day. Even the smallest positive thought can ripple into something incredible. What are you most looking forward to today? Let's kick off this morning with smiles, gratitude, and the best community vibes ever! 💫💕`,
    `@everyone 🍃 Morning blessings to every single one of you! The birds are singing, the day is fresh, and this server is filled with the most incredible people. As you step into today, remember that progress — no matter how small — is still progress. Be kind to yourself, celebrate your journey, and know that you're never walking alone. We've got a whole community of friends right here ready to support and uplift each other. So grab your favorite morning drink, put on your game face, and let's make today one for the books! What's your morning motivation mantra? 🌸✨`,
  ],
  noon: [
    `@everyone 🌤️ Halfway through the day — how's everyone holding up? This is your friendly midday check-in from Hana! Whether your morning was productive or chaotic, the afternoon is a fresh slate. Take a deep breath, step away from the screen for a moment, and give yourself permission to pause. Grab a snack, drink some water, and stretch those shoulders — you deserve a reset! Remember, burnout isn't a badge of honor, so listen to your body and take breaks when you need them. What's been the highlight of your day so far? Let's share some midday joy and keep the good energy flowing! 💖🍵`,
    `@everyone 🕐 It's noon o'clock and you know what that means — time for a collective breather! How has your day been treating you so far? Whether you're crushing it or just surviving, I'm so proud of you for showing up. Don't forget to fuel up with a proper lunch and maybe even sneak in a quick walk or stretch. The afternoon is wide open with potential and you've already made it through half the day — that's something to celebrate! What's your go-to lunch that never lets you down? Let's swap recommendations and refuel together! 🌟🥗`,
    `@everyone ☀️ Noon check-in, besties! The sun is at its peak and so should be our energy for taking care of ourselves! Quick reminder: have you had water recently? Stretched your legs? Taken a moment to just breathe? The grind is important but so is your wellbeing. Step outside for some fresh air if you can, or just close your eyes for 60 seconds and reset. You're doing amazing and the rest of the day is yours to shape however you want. What's one thing you're planning to accomplish before dinner? Let's motivate each other through the afternoon! 💫💕`,
    `@everyone 🌸 Midday magic is in the air! Just popping in to say hello and check on all of you beautiful people. The halfway mark is the perfect time to reassess, recharge, and realign. If the morning didn't go as planned — that's okay! You've got a whole afternoon to turn things around. If it went great — amazing! Keep riding that wave. Either way, don't forget to eat something delicious and hydrate like the precious being you are. What's keeping you motivated today? Share your vibe and let's lift each other up! 🎀✨`,
    `@everyone 🌤️ Hello, afternoon squad! Can you believe we're already halfway through the day? Time flies when you're part of an awesome community! Before you dive back into whatever you're doing, here's your official Hana-approved reminder: hydrate, snack, stretch, repeat. Your body and mind will thank you later. The afternoon is the perfect time to refocus on what matters and let go of any morning stress that's been lingering. You've got this — and you've got a whole server full of friends cheering you on! What's one small win from your morning? Celebrate it! 💖🍃`,
  ],
  evening: [
    `@everyone 🌅 Good evening, lovely souls! The sun is starting its gentle descent and the day is slowly winding down. How was your day? Whether it was absolutely amazing, a little rough, or somewhere in between — you made it through and that's worth celebrating. Take a deep breath and let go of any stress that's been weighing on you. This is your time to unwind, relax, and do something that brings you joy. Put on some cozy music, wrap yourself in a blanket, and let the evening wrap you in its calm embrace. What's your favorite way to decompress after a long day? 🌙💕`,
    `@everyone 🌆 Evening has arrived and with it comes the perfect opportunity to slow down and reflect. Take a moment to appreciate everything you accomplished today — even the small victories deserve recognition. Maybe you finished a project, had a great conversation, or simply got out of bed and showed up — that all counts. Now it's time to treat yourself with kindness. Cook your favorite dinner, watch something comforting, or just scroll through the server and enjoy the company. What was the best part of your day? Let's end tonight on a grateful note! 🎀✨`,
    `@everyone 🌄 As the sky paints itself in shades of gold and pink, I'm sending warm evening wishes to every single one of you. The day is nearly done and you should be so proud of yourself for everything you navigated through — the challenges, the wins, and the quiet moments in between. Now's the time to switch gears from "doing" to "being." Be present, be kind to yourself, and let the evening's peace fill your heart. What's one thing you're grateful for today? Gratitude turns ordinary evenings into magical ones — let's share the warmth! 💫🌸`,
    `@everyone 🌙 Evening blessings, wonderful community! The hustle of the day is fading and now it's time for you. Put your feet up, take a deep exhale, and allow yourself to fully relax. You've carried so much today — responsibilities, emotions, expectations — and you handled it all like the champion you are. Now let the evening be your sanctuary. Whether you're gaming, reading, or just chilling in voice chat, know that you're exactly where you belong. What's your go-to comfort activity when the evening rolls around? Let's swap cozy vibes! 🌟💖`,
    `@everyone 🍂 Soft evening light, cool breezes, and the gentle hum of a day well spent — this is your sign to pause and soak it all in. How are you feeling right now? Whatever the answer is, it's valid and it matters. The evening is a bridge between today's efforts and tomorrow's possibilities, so cross it with grace. Light a candle, play your favorite playlist, or just sit in silence for a bit — whatever recharges your soul. Remember: rest is productive too. What's one lesson today taught you? Let's reflect and grow together! 🌅💕`,
  ],
  midnight: [
    `@everyone 🌙 The clock has struck midnight and the world is quiet — but you're not alone. To every night owl, late-night grinder, and midnight thinker scrolling through the server right now: I see you. There's something magical about these quiet hours when the rest of the world sleeps and you can finally hear your own thoughts. Just remember to be gentle with yourself — late nights are fine but please don't forget to rest eventually. Your sleep matters, your health matters, and tomorrow's you will thank tonight's you for taking care. What's keeping you up tonight? Let's chat in the quiet hours together. 💫🦉`,
    `@everyone 🌌 Midnight greetings to the wonderful souls still awake! The stars are out, the server is peaceful, and there's a special kind of calm that only exists at this hour. Whether you're up working on something important, lost in a game, or just can't seem to fall asleep — you're part of the midnight crew and that makes you pretty special in my book. Take a deep breath and remember that the world will still be there tomorrow. For now, just be present in this quiet moment. What's on your mind at this hour? Sometimes the best conversations happen after midnight. 💖✨`,
    `@everyone 🦉 Hello, midnight wanderers! The moon is high and so is my appreciation for every single one of you. Late nights have a way of bringing out our most honest thoughts — the dreams we're chasing, the worries we're carrying, the ideas that only surface when everything goes still. Whatever brought you here at this hour, know that you're welcome and you're valued. Just a gentle reminder: don't forget to hydrate and please try to get some sleep before sunrise catches you off guard! Who else is part of the midnight crew tonight? Let's keep each other company! 🌙💕`,
    `@everyone 🌠 Midnight has arrived and the server is wrapped in a blanket of stars. To everyone still awake — whether by choice or by circumstance — I'm sending you the coziest, most comforting vibes possible. These quiet hours are yours to use however you need: for deep work, for quiet reflection, or just for scrolling and relaxing. There's no wrong way to spend a late night as long as you're taking care of yourself. Remember to drink water, stretch occasionally, and listen to your body when it whispers "time to rest." What's your favorite midnight soundtrack? 🎀🌌`,
    `@everyone 🌙 The world outside is sleeping but here, in this little corner of the internet, there's still warmth and connection. Whether you're grinding ranked matches, working on a creative project, or just unable to quiet your mind — I want you to know you're not the only one awake. The midnight hours can feel lonely sometimes, but that's what community is for. We've got each other, even at 3 AM. Just promise me you'll get some proper rest soon, okay? Your wellbeing is the most important thing. Sending sleepyhead wishes and midnight magic to all of you! 💫💖`,
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
    let msg = raw.trim();
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
