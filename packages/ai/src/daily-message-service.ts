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

    `@everyone 🌄 Good morning, wonderful community! The sun is peeking over the horizon and it's time to open our eyes to another chance to do great things. Think about what made you smile yesterday — and carry that energy into today. Fresh coffee, fresh ideas, fresh starts are the vibe right now! Before you dive into your adventures, take a moment to appreciate how far you've come. This server is full of amazing people doing amazing things. Let's support each other, share some laughs, and make today even better than yesterday! What's on your agenda today? 🌟💫`,

    `@everyone 🐣 Wakey wakey, everyone! Morning has arrived and so has your daily dose of positive vibes! I hope you slept well and are feeling refreshed for whatever today brings your way. Maybe today you'll learn something new, help someone out, or finally beat that impossible boss — the possibilities are endless. Remember: every great adventure begins with waking up and showing up. You're already winning just by being here! Share one thing you're looking forward to today in chat! Let's make these AM hours count! 🎀⭐`,

    `@everyone 🌸 Morning, morning, morning! Can you feel that fresh energy in the air? It's a brand new canvas and you've got all the colors to paint something beautiful today. I'm sending you all the cozy, productive morning vibes — the kind that make you want to open the curtains, blast some music, and tackle your goals with a smile. Don't forget to hydrate (water is your BFF!), stretch a little, and check in with your friends here when you can. What song are you playing to kick off your morning? 🎵☕✨`,

    `@everyone 🦋 Soft morning light, gentle breeze, and an entire server of amazing people waking up to seize the day — that's the energy right now! Today is unwritten, full of adventures waiting to happen, conversations you haven't had yet, and little victories just around the corner. Move at your own pace, be kind to yourself, and remember that the community is here cheering you on no matter what. Take a screen break when you need it, enjoy your morning rituals, and pop in when you're ready! Good morning, legends! 💖🌻`,
  ],
  noon: [
    `@everyone 🌤️ Happy midday, everyone! The sun is at its peak and so should your hydration levels! Take a moment to step away from whatever you're doing and check in with yourself — have you eaten? Drank water? Stretched your legs? Your body and brain work so hard for you, give them some love! How is your day going so far? Whether you're crushing goals or taking it slow and steady, you're doing great. Let's share a midday check-in in the chat: one emoji that describes your energy level right now! 🥤🍱😊`,

    `@everyone ☀️ Noon check-in — how are we all doing out there? The day is halfway through and I'm so curious to hear how your adventures are unfolding! Remember to blink (yes, actually — screen fatigue is real!), refuel with a proper lunch, and give your mind a little breather. A few minutes away from screens can recharge your whole afternoon. Whether your morning was productive or chaotic, the afternoon is a fresh reset. You've still got so much time to make today great! Drop your lunch emoji in the chat! 🍜🥗🍕`,

    `@everyone 🌞 Midday pause, incoming! Stop whatever you're grinding on for just 60 seconds and do this: roll your shoulders back, unclench your jaw, take three deep breaths, and sip some water. There, doesn't that feel better already? Your brain needs breaks to stay sharp, your body needs movement to stay healthy, and you deserve to take care of both. The afternoon stretch awaits — but first, a little self-care checkpoint! How many glasses of water have you had today? Go refill! 💧🧘💆`,

    `@everyone 🕐 It's noon o'clock and you know what that means — time for the official Midday Vibes Check! Close your eyes for a second, take a nice deep breath, and picture something that makes you happy. That's the energy I want you to carry into the second half of your day. Whether you're gaming, studying, working, or just vibing — you've got this. The community is here, the good vibes are flowing, and the afternoon holds so much potential! What's one thing that made you smile this morning? 😄💫`,

    `@everyone ⛅ Midday greetings to the best community on the planet! The clock says noon which means it's the perfect time to rest your eyes, nourish your body, and reflect on the morning. What went well? What could be even better this afternoon? The beauty of a day is that it's never too late to turn things around or build on your momentum. Go grab a snack, send a nice message to a friend, and come back refreshed for round two of today! Sending you all the cozy noon vibes! 🍎💪🌤️`,
  ],
  evening: [
    `@everyone 🌅 Evening is here and the sky is putting on its most beautiful colors just for you! As the day starts to wind down, I hope you're feeling proud of everything you accomplished — big or small, every step counts. Time to switch gears from grinding to unwinding: cozy lighting, comfort food, and gentle conversations with your favorite people. How was your day? The chat is your campfire tonight, so gather round and share a highlight, a struggle, or just a funny moment from your day! 🏕️🌙💕`,

    `@everyone 🍂 Evening, everyone! The active hours are settling down and the cozy hours are rolling in. Light a candle or your favorite ambient lighting, wrap yourself in something soft, and let the weight of the day gently melt away. Whatever happened today — victories, challenges, unexpected twists — you handled it all like the champion you are. Now it's time for YOU time. Read, game, chat with friends, listen to music... just do what makes your heart feel light. How are you spending your evening? 🎮📖🎵`,

    `@everyone 🌇 Good evening, wonderful souls! The sun is setting and so is the chaos of the day. Take a nice, slow breath and let the evening calm wash over you. I hope today treated you kindly — and if it didn't, I hope the evening brings you the peace and comfort you deserve. Tomorrow is a brand new chance, but tonight is for you. Be gentle with yourself, be present in the moment, and know that this community is always here to share a laugh or a listening ear. Evening vibes activated! ✨🕯️🌸`,

    `@everyone 🌆 Evening check-in! As we transition from daylight to starlight, let's take a moment to appreciate the little things: a good conversation, a funny meme, a level-up, a kind word from a friend. These are the building blocks of a great day. If today didn't go as planned — that's okay too. Rest is productive. Recharging is growth. And you've got a whole community here that believes in you. What's one thing, big or small, that you're grateful for today? 🍃💜🌌`,

    `@everyone 🌙 Soft evening vibes incoming! The world outside is getting quieter and it's the perfect time to turn inward a little — reflect on the day, celebrate your wins, and let go of anything that didn't serve you. You showed up today, you tried your best, and that's more than enough. Now curl up with your favorite evening ritual: gaming session, movie night, late-night chat, or just staring at the ceiling contemplating life (highly underrated activity). Evening is for you. Enjoy it, sweet community! 🛋️☕💫`,
  ],
  midnight: [
    `@everyone 🌌 Midnight hours — the world is quiet, the stars are out, and the night owls are soaring! To everyone still awake: I see you, I appreciate you, and I hope you're taking care of yourself in these still, gentle hours. There's something magical about the midnight community — the conversations feel deeper, the vibes are chiller, and time seems to slow down just for us. Just a gentle reminder that rest is important too — don't forget to eventually tuck yourself in! Sweet dreams when you get there! 🦉🌠💤`,

    `@everyone 🌙 The clock has struck midnight and the night shift is officially in session! Whether you're in a different timezone, pulling a late study session, or just vibing with insomnia — you are not alone and this server still has a pulse. Just a soft, sleepy one. Remember to hydrate (night-time dehydration is real!), give your eyes breaks from the screen, and when the yawns start winning, let them. Tomorrow will be there waiting with fresh coffee and new chances. Until then — midnight crew unite! ✨👻💙`,

    `@everyone 🕛 Midnight! The witching hour is here and so is the quietest, coziest part of the day. If you're reading this right now, you're part of the special midnight club — the dreamers, the thinkers, the late-night creators who find inspiration when the world sleeps. Just don't forget me in the quiet world of nightly inspiration: your body needs rest, your mind needs dreams, and you deserve both. So create, chat, and vibe for a while longer — then let sleep wrap you in its gentle embrace. 🌜💭🌌`,

    `@everyone 🌑 Deep into the night we go — the stars are twinkling just for you, and the world feels like it's holding its breath. I hope whatever is keeping you awake is something that brings you joy (and not just an endless scroll). The nighttime has a way of making everything feel more intimate, more real, more... yours. Enjoy these quiet hours, but listen to your body when it whispers that it's time to rest. You've earned a good night's sleep after everything you did today. Midnight squad, always in my heart! 🖤🌠`,

    `@everyone ✨ Midnight magic is in the air as the calendar quietly turns toward a new day. To our friends in faraway timezones — good morning! To our night owls — good night soon, okay? This server never truly sleeps and that's what makes it beautiful: there's always someone here, always a light on. Whatever you're doing right now — coding, gaming, thinking, creating — I'm cheering you on from the starry skies. Don't forget to eventually close your eyes. The morning will be here before you know it! 🌙💫😴`,
  ],
};

const bootstrapPoolLabel = (slot: TimeSlot): string => {
  const map: Record<TimeSlot, string> = {
    morning: '☀️ Morning pool',
    noon: '🌤️ Noon pool',
    evening: '🌅 Evening pool',
    midnight: '🌙 Midnight pool',
  };
  return map[slot];
};

// ── Lightweight cache (per time slot) ─────────────────────

interface CacheEntry { data: string; timestamp: number; }

class SlotCache {
  store = new Map<string, CacheEntry>();
  hits = 0; misses = 0;

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

  keys(prefix: string): string[] {
    const r: string[] = [];
    const now = Date.now();
    for (const [k, e] of this.store) {
      if (now - e.timestamp > CACHE_TTL) { this.store.delete(k); continue; }
      if (k.startsWith(prefix)) r.push(k);
    }
    return r;
  }

  clear(): void { this.store.clear(); }
  get size(): number { return this.keys('').length; }
}

// ── DailyMessageService ───────────────────────────────────

export class DailyMessageService {
  private caches: Record<TimeSlot, SlotCache>;
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
    this.caches = {
      morning: new SlotCache(),
      noon: new SlotCache(),
      evening: new SlotCache(),
      midnight: new SlotCache(),
    };

    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode');
    logger.info(`DailyMessageService initialized (${parts.join(', ')})`);
  }

  // ── Public API ──────────────────────────────────────────

  async generateDailyMessage(
    timeSlot: TimeSlot,
    serverName: string,
    memberCount: number,
  ): Promise<string> {
    const prefix = `${timeSlot}-`;
    const cache = this.caches[timeSlot];

    // Tier 1: Primary AI
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

    // Tiers 3-5: Cache → Sole → Bootstrap (time-slot-isolated)
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

  /** Clear all cached messages (all time slots). */
  clearAll(): void {
    for (const slot of TIME_SLOTS) this.caches[slot].clear();
  }

  // ── Private ─────────────────────────────────────────────

  async #generateViaAI(
    ai: AIService,
    timeSlot: TimeSlot,
    serverName: string,
    memberCount: number,
  ): Promise<string> {
    const rendered = this.prompts.render('daily-message', {
      timeSlot,
      serverName,
      memberCount: String(memberCount),
    });

    if (!rendered) throw new Error('Prompt template "daily-message" not found');

    const raw = await ai.generate({
      system: rendered.system.replaceAll('${timeOfDay}', timeSlot),
      prompt: rendered.user
        .replaceAll('${timeOfDay}', timeSlot)
        .replaceAll('${serverName}', serverName)
        .replaceAll('${memberCount}', String(memberCount))
        .replaceAll('${timeGuidance}', TIME_GUIDANCE[timeSlot]),
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

    const bootstrap = BOOTSTRAP_POOLS[timeSlot];
    logger.warn(`Daily [${timeSlot}] fallback: bootstrap (${poolLabel} — ${bootstrap.length} available)`);
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
    if (words.length > MAX_WORDS) {
      msg = words.slice(0, MAX_WORDS).join(' ') + ' 💫';
    }
    return msg;
  }
}
