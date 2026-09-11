/**
 * Umamusume Data Miner — approved source registry.
 *
 * This is the authoritative, priority-ordered map of approved Umamusume: Pretty Derby
 * sources. The data-miner tool MUST route through this registry and never invent
 * alternative URL paths or scrape unrelated websites.
 */

export type RequestCategory =
  | 'character'
  | 'support-card'
  | 'skill'
  | 'track'
  | 'game-mechanic'
  | 'scenario'
  | 'guide'
  | 'tool'
  | 'event'
  | 'lore'
  | 'community'
  | 'comparison'
  | 'general';

export interface SourceEntry {
  /** Stable key for this source. */
  key: string;
  /** Authority tier — 1 is the highest (primary game data). */
  priority: number;
  /** Exact, authoritative URL. Do NOT mutate this path. */
  url: string;
  /** Human-readable label. */
  label: string;
  /** What this source is authoritative for. */
  useFor: string;
  /** Special routing notes / rules. */
  note?: string;
  /** The data-miner tool may fall back to uma.guide character data when this source fails. */
  characterFallback?: boolean;
}

/**
 * Priority-ordered registry of approved sources.
 *
 * Rules:
 *  - Use the highest-priority applicable source first.
 *  - Direct URLs are authoritative navigation targets; never guess or mutate them.
 *  - Reddit + fandom are community/lore sources, not authoritative gameplay data.
 */
export const SOURCE_REGISTRY: SourceEntry[] = [
  // ── Priority 1 — Primary Game Data (uma.guide & GameTora) ──
  { key: 'characters',          priority: 1, url: 'https://uma.guide/characters', label: 'Characters', useFor: 'Character profiles, stats, growth rates, aptitudes, unique skills, gameplay data.' },
  { key: 'gametora-characters', priority: 1, url: 'https://gametora.com/umamusume/characters', label: 'GameTora Characters Database', useFor: 'Character database, growth rates, base stats, innate & awakening skills, aptitudes, costumes.' },
  { key: 'support-cards',       priority: 1, url: 'https://uma.guide/support-cards', label: 'Support Cards', useFor: 'Support card data, effects, stats, events, skills, card details.' },
  { key: 'gametora-supports',   priority: 1, url: 'https://gametora.com/umamusume/supports', label: 'GameTora Support Card Database', useFor: 'Support cards database, training bonuses, specialty rate, hints, card tier comparisons.' },
  { key: 'skills',              priority: 1, url: 'https://uma.guide/skills', label: 'Skills', useFor: 'Skill names, effects, conditions, costs, types, skill data.' },
  { key: 'gametora-skills',     priority: 1, url: 'https://gametora.com/umamusume/skills', label: 'GameTora Skill Database', useFor: 'Skill database, trigger conditions, PT costs, durations, gold/white pairs, passive/recovery/accel/velocity/debuff categories.' },
  { key: 'tracks',              priority: 1, url: 'https://uma.guide/tracks', label: 'Tracks', useFor: 'Track, racecourse, distance, surface, conditions, track data.' },
  { key: 'gametora-racetracks', priority: 1, url: 'https://gametora.com/umamusume/racetracks', label: 'GameTora Racetrack Database', useFor: 'Racetrack database, slopes, elevation profiles, straights length, turn directions, acceleration timing.' },
  { key: 'glossary',            priority: 1, url: 'https://uma.guide/guides/glossary', label: 'Terms / Glossary', useFor: 'Terminology, abbreviations, game-specific definitions.' },

  // ── Priority 2 — Planning, Analysis & Game Tools ──
  { key: 'agenda-planner',        priority: 2, url: 'https://uma.guide/agenda-planner', label: 'Agenda Planner', useFor: 'Agenda planning and related planning information.' },
  { key: 'deck-builder',          priority: 2, url: 'https://uma.guide/support-cards/deck-builder', label: 'Deck Builder', useFor: 'Support deck construction and deck analysis.' },
  { key: 'training-simulator',    priority: 2, url: 'https://uma.guide/support-cards/training-simulator', label: 'Training Simulator', useFor: 'Training simulations and support-card interactions.' },
  { key: 'support-compare',       priority: 2, url: 'https://uma.guide/support-cards/compare', label: 'Support Card Comparison', useFor: 'Comparing support cards and their effects.' },
  { key: 'gametora-tier-list',    priority: 2, url: 'https://gametora.com/umamusume/tier-list', label: 'GameTora Tier List', useFor: 'Support card and character meta tier lists, rankings, evaluation.' },
  { key: 'gametora-compatibility',priority: 2, url: 'https://gametora.com/umamusume/compatibility', label: 'GameTora Compatibility Tool', useFor: 'Character inheritance compatibility, affinity calculations, grandfather/grandmother synergy.' },
  { key: 'cm-canvas',             priority: 2, url: 'https://uma.guide/cm-canvas', label: 'CM Canvas / Assets', useFor: 'Champion Meeting assets and related visual/reference data.' },
  { key: 'cm-schedule',           priority: 2, url: 'https://uma.guide/cm-schedule', label: 'Champion Meeting Schedule', useFor: 'Champion Meeting schedules and related timing information.' },
  { key: 'gametora-events',       priority: 2, url: 'https://gametora.com/umamusume/events', label: 'GameTora Events', useFor: 'Event choices, outcomes, rewards, event-related game info.', note: 'Authoritative event database for all character & support card choices.' },

  // ── Priority 3 — General Guides & Game Mechanics ──
  { key: 'guides',              priority: 3, url: 'https://uma.guide/guides', label: 'Guide Overview', useFor: 'Finding relevant guides when no more specific entry applies.' },
  { key: 'independent-training',priority: 3, url: 'https://uma.guide/guides/independent-training', label: 'Independent Training', useFor: 'Independent training mechanics and strategy.' },
  { key: 'beginners',           priority: 3, url: 'https://uma.guide/guides/beginners', label: 'Beginner Guide', useFor: 'Beginner explanations and fundamental gameplay guidance.' },
  { key: 'banners',             priority: 3, url: 'https://uma.guide/guides/banners', label: 'Gacha / Banner Guide', useFor: 'Gacha banners, banner info, pulling guidance.' },
  { key: 'career-mechanics',    priority: 3, url: 'https://uma.guide/guides/career-mechanics', label: 'Career Mechanics', useFor: 'Career mode mechanics and systems.' },
  { key: 'deckbuilding',        priority: 3, url: 'https://uma.guide/guides/deckbuilding', label: 'Deck Building', useFor: 'Support-card deck-building strategy and principles.' },
  { key: 'skills-guide',        priority: 3, url: 'https://uma.guide/guides/skills', label: 'Skill Explanation', useFor: 'General explanations of how skills work.' },
  { key: 'sparks',              priority: 3, url: 'https://uma.guide/guides/sparks', label: 'Sparks & Inheritance', useFor: 'Sparks, inheritance, factors, inheritance mechanics.' },
  { key: 'stats',               priority: 3, url: 'https://uma.guide/guides/stats', label: 'Stats Explained', useFor: 'Stat mechanics and explanations.' },
  { key: 'racecourse-analysis', priority: 3, url: 'https://uma.guide/guides/racecourse-analysis', label: 'Racecourse Analysis', useFor: 'Racecourse-specific analysis and strategy.' },
  { key: 'race-mechanics',      priority: 3, url: 'https://uma.guide/guides/race-mechanics', label: 'Race Mechanics', useFor: 'Race mechanics and race behavior.' },
  { key: 'skill-conditions',    priority: 3, url: 'https://uma.guide/guides/skill-conditions', label: 'Skill Conditions', useFor: 'Understanding skill activation conditions.' },
  { key: 'team-trials',         priority: 3, url: 'https://uma.guide/guides/team-trials', label: 'Team Trials', useFor: 'Team Trials mechanics and strategy.' },

  // ── Priority 4 — Skill-Type Mechanics ──
  { key: 'skills-recovery',        priority: 4, url: 'https://uma.guide/guides/skills-recovery', label: 'Recovery Skills', useFor: 'Recovery skill mechanics.' },
  { key: 'skills-velocity',        priority: 4, url: 'https://uma.guide/guides/skills-velocity', label: 'Velocity Skills', useFor: 'Velocity skill mechanics.' },
  { key: 'skills-acceleration',    priority: 4, url: 'https://uma.guide/guides/skills-acceleration', label: 'Acceleration Skills', useFor: 'Acceleration skill mechanics.' },
  { key: 'skills-vision',          priority: 4, url: 'https://uma.guide/guides/skills-vision', label: 'Vision Skills', useFor: 'Vision skill mechanics.' },
  { key: 'skills-debuff',          priority: 4, url: 'https://uma.guide/guides/skills-debuff', label: 'Debuff Skills', useFor: 'Debuff skill mechanics.' },
  { key: 'skills-lane-movement',   priority: 4, url: 'https://uma.guide/guides/skills-lane-movement', label: 'Lane Movement', useFor: 'Lane movement skill mechanics.' },
  { key: 'skills-special-scaling', priority: 4, url: 'https://uma.guide/guides/skills-special-scaling', label: 'Special Scaling Skills', useFor: 'Special scaling skill mechanics.' },
  { key: 'skill-unique',           priority: 4, url: 'https://uma.guide/guides/skill-unique', label: 'Unique Skills', useFor: 'Unique skill mechanics.' },

  // ── Priority 5 — Scenario & Mode Guides ──
  { key: 'cm-guide',         priority: 5, url: 'https://uma.guide/guides/cm18-guide', label: 'Champion Meeting Guide', useFor: 'Champion Meeting-specific guidance.', note: 'NOT permanently current — resolve the newest CM guide from /guides before trusting this URL.' },
  { key: 'grand-concert',    priority: 5, url: 'https://uma.guide/guides/grand-concert', label: 'Grand Concert', useFor: 'Grand Concert scenario mechanics and strategy.' },
  { key: 'trackblazer',      priority: 5, url: 'https://uma.guide/guides/trackblazer', label: 'Trackblazer', useFor: 'Trackblazer scenario mechanics and strategy.' },
  { key: 'unity-cup-deck',   priority: 5, url: 'https://uma.guide/guides/unity-cup-deckbuilding-guide', label: 'Unity Cup Deckbuilding', useFor: 'Unity Cup deck-building strategy.' },
  { key: 'unity-cup-career', priority: 5, url: 'https://uma.guide/guides/unity-cup-career-guide', label: 'Unity Cup Career', useFor: 'Unity Cup career mechanics and strategy.' },

  // ── Priority 6 — Lore, Multimedia & Community ──
  { key: 'umamusu-wiki', priority: 6, url: 'https://umamusu.wiki/Main_Page', label: 'Umamusu Wiki (Moegirl/En)', useFor: 'In-depth lore, real-life racehorse origins, voice actors (seiyuu), anime/manga adaptations (Cinderella Gray, Star Blossom), discography, character relationships.', characterFallback: true },
  { key: 'fandom-wiki',  priority: 6, url: 'https://umamusume.fandom.com/wiki/Umamusume_Wiki', label: 'Umamusume Fandom Wiki', useFor: 'Character lore, background, real-life racehorse histories, anime episodes, seiyuu, Tracen Academy settings, story summaries.', note: 'Authoritative for lore and media. May block non-browser agents (HTTP 403); falls back to uma.guide/gametora character data.', characterFallback: true },
  { key: 'reddit',       priority: 6, url: 'https://www.reddit.com/r/UmamusumeGame', label: 'r/UmamusumeGame', useFor: 'Community discussion, player experiences, discoveries, strategy discussion.', note: 'Community-sourced only, never authoritative game data.' },
];

/** Maps a request category to the ordered list of source keys to try. */
export const CATEGORY_SOURCE_MAP: Record<RequestCategory, string[]> = {
  character:    ['characters', 'gametora-characters', 'umamusu-wiki', 'fandom-wiki'],
  'support-card': ['support-cards', 'gametora-supports'],
  skill:        ['skills', 'gametora-skills'],
  track:        ['tracks', 'gametora-racetracks'],
  'game-mechanic': ['guides', 'stats', 'race-mechanics', 'career-mechanics'],
  scenario:     ['cm-guide', 'grand-concert', 'trackblazer', 'unity-cup-deck', 'unity-cup-career'],
  guide:        ['guides'],
  tool:         ['deck-builder', 'training-simulator', 'support-compare', 'gametora-compatibility', 'gametora-tier-list', 'agenda-planner'],
  event:        ['gametora-events'],
  // Lore resolves through umamusu.wiki and fandom first, then falls back to uma.guide/gametora
  lore:         ['umamusu-wiki', 'fandom-wiki', 'characters', 'gametora-characters'],
  community:    ['umamusu-wiki', 'fandom-wiki', 'reddit'],
  comparison:   ['support-compare', 'gametora-tier-list', 'support-cards', 'gametora-supports'],
  general:      ['guides', 'characters', 'gametora-characters', 'skills', 'gametora-skills', 'tracks', 'gametora-racetracks', 'support-cards', 'gametora-supports'],
};

export function getSource(key: string): SourceEntry | undefined {
  return SOURCE_REGISTRY.find((s) => s.key === key);
}

/**
 * Classify a free-text request into a RequestCategory using lightweight keyword
 * heuristics. This is a first-pass router; the agent's own planning may override it
 * by passing an explicit `category` argument.
 *
 * "who is X" defaults to `character` (gameplay profile) unless an explicit lore
 * keyword is present — kept in line with "keep uma.guide as the fallback for
 * character queries when lore isn't specifically requested."
 */
export function classifyRequest(text: string): RequestCategory {
  const t = text.toLowerCase();

  // Explicit lore / multimedia intent → lore
  if (/\b(lore|backstory|storyline|relationship|real.life|irl racehorse|racehorse|rival story|seiyuu|voice actor|va|anime|manga|cinderella gray|star blossom|road to the top|movie|umapyoi|tracen academy|three goddesses)\b/.test(t)) return 'lore';
  if (/\b(support card|card|deck|training simulator)\b/.test(t)) return 'support-card';
  if (/\b(unique skill|skill)\b/.test(t)) return 'skill';
  if (/\b(track|racecourse|turf|dirt|distance|surface|speed record)\b/.test(t)) return 'track';
  if (/\b(cm|champion meeting|agenda|canvas|schedule)\b/.test(t)) return 'scenario';
  if (/\b(grand concert|trackblazer|unity cup|scenario)\b/.test(t)) return 'scenario';
  if (/\b(event|choice|reward|outcome)\b/.test(t)) return 'event';
  if (/\b(compare|vs\.|versus|which is better|difference between)\b/.test(t)) return 'comparison';
  if (/\b(reddit|community|players say|discussion|tier list)\b/.test(t)) return 'community';
  if (/\b(mechanic|how does|explain|beginner|banner|gacha|career|sparks|inheritance|stats)\b/.test(t)) return 'game-mechanic';
  // "who is X", character names, or the general umamusume term → character profile.
  if (/\b(who is|character|umamusume|horse girl|trainer)\b/.test(t)) return 'character';

  return 'general';
}
