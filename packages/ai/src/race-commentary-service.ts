import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from './index.js';
import type { PromptLibrary } from './prompts.js';

const logger = createLogger('RaceCommentaryService');

const FINISH_LINE = 50_000_000;  // 50M monthly
const TRACK_METERS = 3000;       // 3000m race
const MAX_RACERS = 30;
const MIN_WORDS = 100;
const MAX_WORDS = 500;
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

// ── Types ───────────────────────────────────────────────

export interface RacerData {
  trainerId: string;
  trainerName: string;
  monthlyFans: number;
}

export interface TrainerPosition {
  name: string;
  position: number;      // meters on the 3000m track
  monthly: number;        // monthly fan gain
  finished: boolean;      // crossed 50M?
}

export interface DynamicEvent {
  type: 'overtake' | 'new_entry' | 'retirement' | 'finisher';
  name: string;
  detail: string;
}

export interface RaceState {
  month: number;
  day: number;
  previousPositions: Record<string, TrainerPosition>;
  previousRacers: string[];  // trainerIds from yesterday's top 30
}

// ── Bootstrap pool (5 pre-written race broadcasts) ──────

const BOOTSTRAP_POOL: string[] = [
  `@everyone 🐎📢 LIVE FROM UMATRACK RACEWAY — THE 3000m MONTHLY GRAND PRIX!

The grandstand is buzzing, the turf is freshly groomed, and our field of racers is thundering down the backstretch under a brilliant evening sky! Every stride, every gallop, every hoof-beat echoes through the paddock as these elite horse-girls chase glory across the 3000m course.

At the front of the pack, our leaders are setting a blistering pace — breaking away from the field with the determination of champions who know the finish line awaits! The mid-field is a beautiful chaos of positioning battles and tactical gallops, racers jostling for every meter of turf. And at the back, the heart of this sport shines brightest — those grinding out every stride, refusing to yield, because in UMATRACK, every racer matters!

The track is fast, the competition is fierce, and the month is far from over. Who will conquer UMATRACK? Who will cross that 50M finish line first? The answer is being written RIGHT NOW on this sacred turf! TUNE IN TOMORROW FOR THE NEXT BROADCAST! 🏆🔥🐎`,

  `@everyone 🏆📡 UMATRACK 3000m — THE RACE CONTINUES!

Crisp evening air sweeps across the grandstand as our racers charge through another day of this grueling month-long campaign! The 3000m track stretches ahead like a canvas of destiny, and every trainer on this turf is painting their masterpiece with every galloping stride!

The front-runners are setting a pace that has the commentators gasping — the gap between glory and heartbreak measured in mere meters of manicured turf! Mid-pack skirmishes are erupting across the backstretch as rivalries ignite and racing dreams collide under the floodlights! And from the rear of the field, the sound of thundering hooves reminds us all — it's not where you start, it's where you FINISH that echoes through the paddock halls of history!

The fans are on their feet, the trainers are giving everything, and the 50M finish line glimmers like a beacon on the horizon. This is UMATRACK. This is the race that defines champions. SEE YOU TOMORROW NIGHT! 🌟💫🐎`,

  `@everyone 🌙📢 NIGHT FALLS ON UMATRACK BUT THE 3000m RAGE ON!

Under the stadium lights, the turf shimmers like a river of silver as our field of warriors continues their relentless march toward the 50M finish line! The atmosphere is electric — you can feel the tension crackling through the grandstand like lightning before a storm!

Position battles are BREWING across every sector of the track! The leaders are eyeing each other with the intensity of rivals who know every meter matters! The chasing pack is closing gaps with bursts of speed that have the crowd roaring! And the back-markers — oh, the back-markers — they're running with the heart of champions, every stride a declaration that they BELONG on this sacred turf!

The month marches on, the meter count climbs, and somewhere out there on this 3000m battlefield, a legend is being forged one gallop at a time. The paddock is alive, the turf is calling, and UMATRACK never sleeps! BROADCAST RESUMES TOMORROW — DON'T MISS IT! 🌟🔥🏇`,

  `@everyone 🐎🎙️ UMATRACK 3000m GRAND PRIX — LIVE COMMENTARY!

The evening turf is firm, the weather is PERFECT for racing, and the grandstand is a sea of waving flags and thundering cheers! Our racers are spread across the full 3000m like stars scattered across a racing galaxy — each one burning bright with the fire of competition!

AT THE FRONT — pure poetry in motion! The leaders are stretching their legs, finding that elite rhythm that separates champions from contenders! The gap is widening and closing like the breath of the turf itself, every surge met with a counter, every attack parried with brilliance! MID-FIELD CHAOS — positioning wars of the highest order! Racers trading meters like prize fighters trading blows, each one clawing for that perfect line into the homestretch! AND THE BACK STRETCH — don't you DARE look away! The heart of UMATRACK beats loudest where the fight is fiercest!

The 50M finish line waits for no one, but every stride brings someone closer to glory. The turf remembers EVERY gallop. THE RACE CONTINUES TOMORROW! 🏆💕🐎`,

  `@everyone 🏇🌟 UMATRACK RACEWAY — 3000m LIVE UPDATE!

The sun has set on another day of this EPIC month-long campaign, but the embers of competition still glow hot across every meter of this hallowed 3000m track! From the starting gate to the distant finish line, our field of racers has left EVERYTHING on the turf!

The pace setters are carving through the distance with surgical precision — every gallop calculated, every stride measured against the relentless march of the monthly clock! Behind them, the chase pack is a beautiful storm of ambition and athleticism, racers surging and counter-surging in a ballet of competitive fury! And the courageous souls bringing up the rear — they represent the very SOUL of this sport: resilience, determination, and the unshakeable belief that tomorrow brings another chance to close the gap!

The 50M milestone gleams on the horizon like a star calling every racer home. The paddock is alive with anticipation. The turf is sacred ground. AND UMATRACK ROLLS ON! JOIN US TOMORROW NIGHT! 👑✨🐎`,
];

// ── Cache ───────────────────────────────────────────────

interface CacheEntry { data: string; timestamp: number; }

class RaceCache {
  private store = new Map<string, CacheEntry>();

  get(key: string): string | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() - e.timestamp > CACHE_TTL) { this.store.delete(key); return null; }
    return e.data;
  }

  set(key: string, data: string): void {
    if (this.store.size >= 100 && !this.store.has(key)) {
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

  get size(): number { return this.keys().length; }
  clear(): void { this.store.clear(); }
}

// ── RaceCommentaryService ─────────────────────────────────

export class RaceCommentaryService {
  private cache: RaceCache;
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
    this.cache = new RaceCache();

    const parts: string[] = [];
    if (primaryAI) parts.push(`primary: ${primaryAI.getCurrentModel()}`);
    if (fallbackAI) parts.push(`fallback: ${fallbackAI.getCurrentModel()}`);
    if (parts.length === 0) parts.push('cache-only mode');
    logger.info(`RaceCommentaryService initialized (${parts.join(', ')})`);
  }

  // ── Public: Calculate positions ──────────────────────

  /**
   * Takes ALL trainers from the fan tracker, selects the top 30 by monthlyFans,
   * calculates their position on the 3000m track, and returns sorted positions.
   */
  static calculatePositions(allTrainers: RacerData[]): TrainerPosition[] {
    const sorted = [...allTrainers]
      .sort((a, b) => b.monthlyFans - a.monthlyFans)
      .slice(0, MAX_RACERS);

    return sorted.map(t => ({
      name: t.trainerName,
      position: Math.min(TRACK_METERS, (t.monthlyFans / FINISH_LINE) * TRACK_METERS),
      monthly: t.monthlyFans,
      finished: t.monthlyFans >= FINISH_LINE,
    }));
  }

  // ── Public: Detect dynamic events ────────────────────

  /**
   * Compare today's positions to yesterday's state to detect:
   * - Overtakes: trainer A passed trainer B
   * - New entries: trainer in today's top 30 but not yesterday's
   * - Retirements: trainer in yesterday's top 30 but not today's
   * - Finishers: trainer crossed 50M between yesterday and today
   */
  static detectEvents(
    today: TrainerPosition[],
    state: RaceState | null,
  ): DynamicEvent[] {
    if (!state) return []; // Day 1 — no history

    const todayMap = new Map(today.map(t => [t.name, t]));
    const yesterdayMap = new Map<string, TrainerPosition>(
      Object.entries(state.previousPositions).map(([, v]) => [v.name, v]),
    );
    const yesterdayNames = Object.values(state.previousPositions).map(p => p.name);

    const events: DynamicEvent[] = [];

    // Finishers: crossed 50M since yesterday
    for (const t of today) {
      if (t.finished) {
        const was = yesterdayMap.get(t.name);
        if (!was || !was.finished) {
          events.push({
            type: 'finisher',
            name: t.name,
            detail: `crossed the 50M monthly finish line with ${(t.monthly / 1e6).toFixed(1)}M fans!`,
          });
        }
      }
    }

    // Overtakes: compare sorted by position
    const todaySorted = [...today].sort((a, b) => b.position - a.position);
    const yesterdaySorted = yesterdayNames
      .map(n => yesterdayMap.get(n)!)
      .filter(Boolean)
      .sort((a, b) => b.position - a.position);

    const todayRank = new Map(todaySorted.map((t, i) => [t.name, i]));
    const yesterdayRank = new Map(yesterdaySorted.map((t, i) => [t.name, i]));

    for (const t of today) {
      const tRank = todayRank.get(t.name);
      const yRank = yesterdayRank.get(t.name);
      if (tRank !== undefined && yRank !== undefined && tRank < yRank) {
        // Passed at least one person — find who they passed most dramatically
        const overtaken = yesterdaySorted
          .filter((_, i) => i < yRank && i >= tRank)
          .map(y => y.name);
        if (overtaken.length > 0) {
          events.push({
            type: 'overtake',
            name: t.name,
            detail: `moved from rank ${yRank + 1} to ${tRank + 1}, passing ${overtaken.slice(0, 2).join(' and ')}${overtaken.length > 2 ? ` and ${overtaken.length - 2} more` : ''}!`,
          });
        }
      }
    }
    // Limit overtakes to top 5 most dramatic (by rank change)
    const overtakes = events.filter(e => e.type === 'overtake');
    if (overtakes.length > 5) {
      overtakes.sort((a, b) => {
        const aGain = a.detail.match(/from rank (\d+)/)?.[1] ?? '0';
        const bGain = b.detail.match(/from rank (\d+)/)?.[1] ?? '0';
        return parseInt(bGain) - parseInt(aGain);
      });
      const keepNames = new Set(overtakes.slice(0, 5).map(o => o.name));
      const filtered = events.filter(e => e.type !== 'overtake' || keepNames.has(e.name));
      events.length = 0; events.push(...filtered);
    }

    // New entries: in today's top 30 but not yesterday's
    for (const t of today) {
      if (!yesterdayMap.has(t.name)) {
        events.push({
          type: 'new_entry',
          name: t.name,
          detail: `entered the race at ${formatMeters(t.position)} with ${(t.monthly / 1e6).toFixed(1)}M monthly fans!`,
        });
      }
    }

    // Retirements: in yesterday's top 30 but not today's
    const todayNames = new Set(today.map(t => t.name));
    for (const name of yesterdayNames) {
      if (!todayNames.has(name)) {
        const prev = yesterdayMap.get(name)!;
        events.push({
          type: 'retirement',
          name,
          detail: `was at ${formatMeters(prev.position)} with ${(prev.monthly / 1e6).toFixed(1)}M monthly fans — pulled from the race.`,
        });
      }
    }

    return events;
  }

  // ── Public: Generate commentary ───────────────────────

  async generateCommentary(
    positions: TrainerPosition[],
    events: DynamicEvent[],
    state: RaceState,
    serverName: string,
  ): Promise<string> {
    const racerText = this.#formatPositions(positions);
    const eventsText = this.#formatEvents(events);
    const totalDays = new Date(new Date().getFullYear(), state.month, 0).getDate();

    // Tier 1: Primary
    if (this.primaryAI) {
      try {
        const msg = await this.#generateViaAI(this.primaryAI, racerText, eventsText, state.day, totalDays, serverName);
        this.cache.set(`race-d${state.day}`, msg);
        logger.info(`Race commentary generated via primary (day ${state.day}, ${positions.length} racers)`);
        return msg;
      } catch (err: any) {
        logger.warn(`Race commentary primary failed: ${err.message}. Trying fallback...`);
      }
    }

    // Tier 2: Fallback
    if (this.fallbackAI) {
      try {
        const msg = await this.#generateViaAI(this.fallbackAI, racerText, eventsText, state.day, totalDays, serverName);
        this.cache.set(`race-d${state.day}`, msg);
        logger.info(`Race commentary generated via fallback (day ${state.day})`);
        return msg;
      } catch (err: any) {
        logger.warn(`Race commentary fallback failed: ${err.message}. Going to cache...`);
      }
    }

    // Tiers 3-5: Cache → Sole → Bootstrap
    return this.#fallbackCommentary();
  }

  getPoolSize(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }

  // ── Private ─────────────────────────────────────────────

  async #generateViaAI(
    ai: AIService,
    racerText: string,
    eventsText: string,
    day: number,
    totalDays: number,
    serverName: string,
  ): Promise<string> {
    const rendered = this.prompts.render('race-commentary', {
      day: String(day),
      totalDays: String(totalDays),
      racerPositions: racerText,
      dynamicEvents: eventsText || 'No major events today — smooth racing all around.',
      serverName,
    });

    if (!rendered) throw new Error('Prompt template "race-commentary" not found');

    const raw = await ai.generate({
      system: rendered.system,
      prompt: rendered.user,
    });

    return this.#sanitize(raw);
  }

  #fallbackCommentary(): string {
    const pool = this.cache.keys();
    if (pool.length >= 2) {
      const msg = this.cache.get(pool[Math.floor(Math.random() * pool.length)]);
      if (msg) { logger.info(`Race commentary fallback: random cache (${pool.length})`); return msg; }
    }
    if (pool.length === 1) {
      const msg = this.cache.get(pool[0]);
      if (msg) { logger.info('Race commentary fallback: sole cached'); return msg; }
    }
    logger.warn('Race commentary fallback: bootstrap');
    return BOOTSTRAP_POOL[Math.floor(Math.random() * BOOTSTRAP_POOL.length)];
  }

  #formatPositions(positions: TrainerPosition[]): string {
    if (positions.length === 0) return 'No racers on the track today.';

    const sorted = [...positions].sort((a, b) => b.position - a.position);
    const lines: string[] = [];
    lines.push(`--- RACER POSITIONS (${positions.length} on the track) ---`);
    lines.push('');

    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const flag = t.finished ? ' 🏆FINISHED!' : '';
      const mPos = formatMeters(t.position);
      const mFan = t.monthly >= 1_000_000
        ? `${(t.monthly / 1e6).toFixed(1)}M`
        : `${(t.monthly / 1e3).toFixed(0)}K`;
      lines.push(`${medal} ${t.name.padEnd(20)}  ${mPos.padEnd(10)}  ${mFan} fans${flag}`);
    }

    return lines.join('\n');
  }

  #formatEvents(events: DynamicEvent[]): string {
    if (events.length === 0) return 'No major events today — steady racing across the field.';

    const lines: string[] = [];
    lines.push('--- DYNAMIC EVENTS ---');

    const overtakes = events.filter(e => e.type === 'overtake');
    const entries = events.filter(e => e.type === 'new_entry');
    const retirements = events.filter(e => e.type === 'retirement');
    const finishers = events.filter(e => e.type === 'finisher');

    if (overtakes.length > 0) {
      lines.push('');
      for (const o of overtakes) {
        lines.push(`⚡ OVERTAKE: ${o.name} ${o.detail}`);
      }
    }
    if (entries.length > 0) {
      lines.push('');
      for (const e of entries) {
        lines.push(`🆕 NEW ENTRY: ${e.name} ${e.detail}`);
      }
    }
    if (retirements.length > 0) {
      lines.push('');
      for (const r of retirements) {
        lines.push(`💨 RETIRED: ${r.name} ${r.detail}`);
      }
    }
    if (finishers.length > 0) {
      lines.push('');
      for (const f of finishers) {
        lines.push(`🏆 FINISHER: ${f.name} ${f.detail}`);
      }
    }

    return lines.join('\n');
  }

  #sanitize(raw: string): string {
    let msg = raw.trim();
    if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'"))) {
      msg = msg.slice(1, -1).trim();
    }
    if (!msg.includes('@everyone')) msg = `@everyone ${msg}`;
    const words = msg.split(/\s+/);
    if (words.length > MAX_WORDS) msg = words.slice(0, MAX_WORDS).join(' ') + ' 🔥';
    return msg;
  }
}

// ── RaceState persistence helpers ─────────────────────────
// Requires Node.js fs/path (available in Discord bot runtime)

export async function loadRaceState(filePath: string): Promise<RaceState | null> {
  try {
    const { promises: fs } = await import('node:fs');
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as RaceState;
  } catch {
    return null;
  }
}

export async function saveRaceState(filePath: string, state: RaceState): Promise<void> {
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

export function buildRaceState(
  positions: TrainerPosition[],
  racerIds: string[],
): RaceState {
  const now = new Date();
  const previousPositions: Record<string, TrainerPosition> = {};
  for (const p of positions) {
    previousPositions[p.name] = p;
  }
  return {
    month: now.getMonth() + 1,
    day: now.getDate(),
    previousPositions,
    previousRacers: racerIds,
  };
}

// ── Helpers ──────────────────────────────────────────────

function formatMeters(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}
