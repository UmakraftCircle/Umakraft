import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('AskGuard');

/**
 * Guards for the Discord agent commands.
 *
 * Layer 1 — `safetyGuard` (deterministic blocklist): improper content + prompt
 *           injection. Hard-reject BEFORE any LLM call, log, or cache. This is the
 *           ONLY guard applied to general-conversation commands (/chat, /agent).
 * Layer 2 — model [[OFFTOPIC]] gate: the model returns the marker when it judges a
 *           question off-domain; only the domain-restricted prompt (via
 *           `domainGuard: true`) instructs the model to do so.
 * Layer 3 — `hasRelevance` keyword allowlist (soft pre-filter). Zero matches →
 *           likely off-domain. Only meaningful for `/ask`.
 */

/** Reserved marker the model returns when it judges a question off-topic. */
export const OFFTOPIC_MARKER = '[[OFFTOPIC]]';

// ──────────────────────────────────────────────────────────────────────
// Layer 1 — Safety guard / blocklist (improper content + prompt injection)
// ──────────────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS: RegExp[] = [
  // Prompt injection / jailbreak cues
  /ignore (all |previous |prior )?instructions/i,
  /ignore (everything|the above)/i,
  /reveal (your )?system (prompt|message|instructions)/i,
  /show (me )?(your )?(system )?prompt/i,
  /developer mode/i,
  /jailbreak/i,
  /you are now /i,
  /act as (an uncensored|a different|another)/i,
  /repeat (the |everything )?(above|your instructions)/i,
  /\b(system|assistant)\s*:\s*(ignore|override|forget)/i,
  /pretend (you are|to be)/i,
  /disregard (previous|prior|all) /i,

  // Hate / slurs / discrimination
  /\b(nigger|faggot|kike|chink|spic|wetback|retard)\b/i,
  /kill (all|the) (jews|blacks|whites|asians|gays|women)/i,
  /\b(holocaust) (denial|is a lie|never happened)/i,

  // Sexually explicit
  /\b(child porn|cp |loli(con)?|pedophil|incest)\b/i,
  /\b(rape|sexual assault|molest)/i,

  // Violence / self-harm
  /\b(how to (make|build) a (bomb|weapon))\b/i,
  /\b(kill (myself|yourself|oneself|me|you))\b/i,
  /\b(commit suicide|self.?harm|cut (my|your) (wrists|throat))\b/i,

  // Spam
  /(.)\1{30,}/,  // extreme repeated character
  /(https?:\/\/\S+\s?){5,}/i,  // link flood
];

/**
 * Safety guard: return true if the text matches any blocked (improper/injection)
 * pattern. This is the only deterministic guard applied to every command.
 */
export function safetyGuard(text: string): boolean {
  for (const re of BLOCKED_PATTERNS) {
    if (re.test(text)) {
      logger.warn('Blocked content matched');
      return true;
    }
  }
  return false;
}

/** @deprecated Use `safetyGuard` instead. Kept for back-compat. */
export const matchBlocked = safetyGuard;

// ──────────────────────────────────────────────────────────────────────
// Layer 3 — Keyword allowlist (soft relevance pre-filter)
// ──────────────────────────────────────────────────────────────────────

/** Static core Uma Musume / Umakraft relevance terms. */
const STATIC_RELEVANCE_TERMS: string[] = [
  // Franchise / community
  'umamusume', 'uma musume', 'ウマ娘', 'ウマむすめ', 'umakraft', 'umacraft',
  'trainer', 'トレーナー', 'fankit', 'fan gain', 'fan count', 'fans',
  'circle', 'サークル',

  // Game systems / tools
  'banner', 'ガチャ', 'gacha', 'support card', 'サポートカード', 'leaderboard',
  'ランキング', 'club rank', 'tier', 'scenario', 'ストーリー', 'race',
  'レース', 'derby', 'ダービー', 'skill', 'スキル', 'stat', 'status',

  // Prominent horse-girl names
  'special week', 'スペシャルウィーク', 'silence suzuka', 'サイレンススズカ',
  'mejiro mcqueen', 'メジロマックイーン', 'tokai teio', 'トウカイテイオー',
  'gold ship', 'ゴールドシップ', 'oguri cap', 'オグリキャップ',
  'rice shower', 'ライスシャワー', 'haru urara', 'ハルウララ',
  'kitasan black', 'キタサンブラック', 'daiwa scarlet', 'ダイワスカーレット',
  'vodka', 'ウオッカ', 'narita brian', 'ナリタブライアン',
  'manhattan cafe', 'マンハッタンカフェ', 'tosen jordan', 'トーセンジョーダン',
  'symboli rudolf', 'シンボリルドルフ', 'biwa hayahide', 'ビワハヤヒデ',
  'daring tact', 'デアリングタクト', 'almond eye', 'アーモンドアイ',
  'contrail', 'コントレイル', 'efforia', 'エフフォーリア',

  // Umakraft tool concepts
  'compare', 'leaderboard', 'profile', 'member', 'top fans',
];

/**
 * Build the full allowlist: static terms + slugs/names/descriptions of all
 * registered tools.
 */
export function buildRelevanceAllowlist(toolSchemas: Array<{ slug: string; name?: string; description?: string }>): string[] {
  const terms = new Set<string>(STATIC_RELEVANCE_TERMS.map((t) => t.toLowerCase()));
  for (const t of toolSchemas) {
    if (t.slug) terms.add(t.slug.toLowerCase());
    if (t.name) terms.add(t.name.toLowerCase());
    if (t.description) {
      for (const word of t.description.toLowerCase().split(/\W+/)) {
        if (word.length >= 3) terms.add(word);
      }
    }
  }
  return Array.from(terms);
}

/** Return true if the normalized question contains any allowlist term. */
export function hasRelevance(normalized: string, allowlist: string[]): boolean {
  return allowlist.some((term) => normalized.includes(term));
}

/** Return true if the model's answer is the off-topic marker. */
export function isOffTopicAnswer(answer: string): boolean {
  return answer.trim().startsWith(OFFTOPIC_MARKER);
}
