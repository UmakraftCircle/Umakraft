/**
 * OffTopicDetector — lightweight topic classifier.
 *
 * Scope: determines whether a request is about Umamusume (IN_SCOPE) or not
 * (OFF_TOPIC). Run BEFORE the LLM. Search is an escalation, not the primary
 * detector. Safety/harm detection is intentionally OUT of scope — it belongs to
 * the separate safetyGuard that runs earlier in /ask.
 */

import type {
  SearchEscalator,
  TaxonomyTerm,
  TopicVerdict,
} from './types.js';

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalize(text: string): string {
  const lowered = text.toLowerCase();
  return lowered.replace(/[\s\u3000]+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export interface MatchResult {
  tier: 'none' | 'weak' | 'strong';
  matchedTerms: string[];
}

export function matchTaxonomy(
  normalizedText: string,
  taxonomy: TaxonomyTerm[],
): MatchResult {
  const strong: string[] = [];
  const weak: string[] = [];

  for (const row of taxonomy) {
    const term = normalize(row.term);
    if (!term) continue;
    if (normalizedText.includes(term)) {
      if (row.tier === 'strong') strong.push(row.term);
      else weak.push(row.term);
    }
  }

  if (strong.length > 0) return { tier: 'strong', matchedTerms: strong };
  if (weak.length > 0) return { tier: 'weak', matchedTerms: weak };
  return { tier: 'none', matchedTerms: [] };
}

// ---------------------------------------------------------------------------
// "Clearly unrelated" heuristic
// ---------------------------------------------------------------------------

const UNRELATED_PHRASES = [
  'weather',
  'capital of',
  'recipe',
  'how to cook',
  'translate',
  'translation',
  'homework',
  'math',
  'what is the time',
  'stock price',
  'weather forecast',
  'how far is',
  'directions to',
  'tax return',
  'crypto',
  'bitcoin',
];

const UNRELATED_SUBJECT_HINTS = [
  'france', 'paris', 'germany', 'japan', 'canada', 'australia',
  'president', 'election', 'government', 'physics', 'chemistry',
  'biology', 'history of', 'the capital', 'soccer', 'basketball',
  'formula 1', 'f1', 'racing car',
  'python', 'javascript', 'docker', 'kubernetes',
];

export function isClearlyUnrelated(normalizedText: string): boolean {
  for (const p of UNRELATED_PHRASES) {
    if (normalizedText.includes(p)) return true;
  }
  for (const h of UNRELATED_SUBJECT_HINTS) {
    if (normalizedText.includes(h)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

export function searchConfirmsRelation(
  result: Awaited<ReturnType<SearchEscalator>>,
): boolean {
  if (!result.success) return false;
  const excerpts = result.excerpts;
  if (!excerpts || excerpts.length === 0) return false;
  return excerpts.some(
    (e) => e && typeof e.text === 'string' && e.text.trim().length > 0,
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface OffTopicDetectorOptions {
  taxonomy: TaxonomyTerm[];
  search?: SearchEscalator;
}

/**
 * Classify a request as IN_SCOPE or OFF_TOPIC.
 */
export async function classifyTopic(
  text: string,
  options: OffTopicDetectorOptions,
): Promise<TopicVerdict> {
  const normalized = normalize(text);

  if (!normalized) {
    return { verdict: 'OFF_TOPIC', confidence: 'low', method: 'search' };
  }

  const match = matchTaxonomy(normalized, options.taxonomy);

  if (match.tier === 'strong') {
    return { verdict: 'IN_SCOPE', confidence: 'high', method: 'taxonomy' };
  }

  if (isClearlyUnrelated(normalized)) {
    return { verdict: 'OFF_TOPIC', confidence: 'high', method: 'taxonomy' };
  }

  if (options.search) {
    const confirmed = searchConfirmsRelation(await options.search(normalized));
    return confirmed
      ? { verdict: 'IN_SCOPE', confidence: 'high', method: 'search' }
      : { verdict: 'OFF_TOPIC', confidence: 'low', method: 'search' };
  }

  return { verdict: 'OFF_TOPIC', confidence: 'low', method: 'search' };
}
