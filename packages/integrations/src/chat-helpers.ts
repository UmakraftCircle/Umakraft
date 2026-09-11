/**
 * Pure, framework-free helpers for the `/chat` command.
 *
 * Kept free of Turso, Discord, and LLM dependencies so these functions can be
 * unit-tested directly (see tests/integrations/chat-helpers.test.ts).
 */

/**
 * Extract explicitly-stated favourite umamusume names from a Trainer's message,
 * using a conservative heuristic.
 *
 * DESIGN: only an EXPLICIT statement ("my favourite is X", "I love X", "X is my
 * favourite") yields a favourite. A passing mention ("I used Tokai Teio in my last
 * race") must NOT be treated as a favourite — that is the rule, so we only match
 * strong patterns here.
 */
export function detectFavoriteUmamusume(text: string): string[] {
  const patterns: RegExp[] = [
    /(?:my\s+)?(?:favourites?|favorites?)\s+(?:umamusume|horse\s*girls?|characters?)?\s*(?:is|are|:)\s*([^.!?\n]+)/i,
    /i\s+(?:really\s+)?(?:love|like|adore)\s+([a-z][^.!?\n]{0,120})/i,
    /([a-z][^.!?\n]*?)\s+(?:is|are)\s+my\s+(?:favourites?|favorites?)/i,
  ];

  const favorites: string[] = [];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const raw = m[1] ?? m[2] ?? '';
      const parts = raw
        .split(/,|\band\b|&/i)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p.length <= 60 && /[a-z]/i.test(p));
      for (const p of parts) favorites.push(p);
    }
  }
  return Array.from(new Set(favorites));
}

/** Deterministic long-term digest summarizer (avoids extra LLM calls). */
export async function summarizeQuestions(
  questions: string[],
  previousDigest: string | null,
): Promise<string> {
  const topics = questions
    .filter(Boolean)
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter((q) => q.length > 0);
  if (topics.length === 0) return previousDigest ?? '';
  const joined = topics.slice(0, 10).join('; ');
  const prev = previousDigest ? `${previousDigest}\n` : '';
  return `${prev}${new Date().toISOString()}: ${joined}`;
}

/**
 * Build a personalised conversation-context string from recent turns.
 * Renders as `Trainer: …\nAssistant: …`.
 */
export function buildContextTurns(
  recent: { role: 'user' | 'assistant'; content: string }[],
  maxTurns = 20,
): string | undefined {
  const turns = recent.slice(-maxTurns);
  if (turns.length === 0) return undefined;
  return turns
    .map((t) => `${t.role === 'user' ? 'Trainer' : 'Assistant'}: ${t.content}`)
    .join('\n');
}
