import { createLogger } from '@ai-agent-platform/shared';
import { createProvider } from './providers.js';
import type { AIService } from './index.js';

const logger = createLogger('CompareSummaryService');

export interface SimpleCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class SimpleCache<T = any> {
  private store = new Map<string, SimpleCacheEntry<T>>();
  constructor(private options: { namespace?: string; defaultTTL?: number } = {}) {}

  get<U = T>(key: string): U | null {
    const fullKey = `${this.options.namespace || 'default'}:${key}`;
    const entry = this.store.get(fullKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(fullKey);
      return null;
    }
    return entry.data as unknown as U;
  }

  set(key: string, data: T, ttl?: number): void {
    const fullKey = `${this.options.namespace || 'default'}:${key}`;
    this.store.set(fullKey, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.options.defaultTTL ?? COMPARE_SUMMARY_TTL_MS,
    });
  }
}

/**
 * Fan-gain comparison summary cache keyed on an ORDER-INDEPENDENT pair of
 * Umamusume trainer IDs + period, so `(A, B)` and `(B, A)` reuse the same
 * entry. Entries expire after 12 hours, after which a fresh message may be
 * generated for the same trainer pair.
 */
export const COMPARE_SUMMARY_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface CompareSummaryInput {
  trainer1Id: string;
  trainer1Name: string;
  trainer1Gain: number;
  trainer2Id: string;
  trainer2Name: string;
  trainer2Gain: number;
  period: 'daily' | 'weekly' | 'monthly';
}

export interface CompareSummaryResult {
  summary: string;
  cached: boolean;
}

export function compareCacheKey(
  trainer1Id: string,
  trainer2Id: string,
  period: string,
): string {
  const [a, b] = [String(trainer1Id), String(trainer2Id)].sort();
  return `${a}::${b}::${period}`;
}

const SYSTEM_PROMPT = [
  'You are a passionate and inspiring fan-trainer coach for the Umamusume fan tracker.',
  "Write a short, motivating comparison summary of two trainers' fan gains.",
  'Rules:',
  '- 50 to 100 words.',
  "- Describe BOTH trainers' gains for the given period.",
  '- State clearly which trainer gained more, and by how much.',
  '- Say "Tie" if the two gains are equal.',
  '- NEVER decide the winner by comparing total fan counts — only by the period gain.',
  '- Be encouraging and uplifting toward BOTH trainers; motivate them to keep going.',
  '- Do not use markdown headings or bullet lists. Return plain prose only.',
  '- Do not invent numbers; use only the exact figures provided.',
].join('\n');

function formatGain(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US')}`;
}

export class CompareSummaryService {
  constructor(
    private primaryAI: AIService,
    private fallbackAI?: AIService | null,
    private cache: SimpleCache<{ summary: string }> = new SimpleCache<{ summary: string }>({
      namespace: 'compare-summary',
      defaultTTL: COMPARE_SUMMARY_TTL_MS,
    }),
  ) {}

  public getCache(): SimpleCache<{ summary: string }> {
    return this.cache;
  }

  public async generate(input: CompareSummaryInput): Promise<CompareSummaryResult> {
    const key = compareCacheKey(input.trainer1Id, input.trainer2Id, input.period);

    const cached = this.cache.get<{ summary: string }>(key);
    if (cached) {
      logger.info(`Compare summary cache HIT for ${key}`);
      return { summary: cached.summary, cached: true };
    }

    const prompt = [
      `Period: ${input.period}`,
      `Trainer 1: ${input.trainer1Name} (${input.trainer1Id}) — gained ${formatGain(input.trainer1Gain)} fans.`,
      `Trainer 2: ${input.trainer2Name} (${input.trainer2Id}) — gained ${formatGain(input.trainer2Gain)} fans.`,
      '',
      'Write the inspiring comparison summary now.',
    ].join('\n');

    let summary: string | null = null;
    try {
      summary = await this.primaryAI.generate({ system: SYSTEM_PROMPT, prompt });
    } catch (err: any) {
      logger.warn(`Primary AI failed for compare summary: ${err?.message ?? err}`);
      if (this.fallbackAI) {
        try {
          summary = await this.fallbackAI.generate({ system: SYSTEM_PROMPT, prompt });
        } catch (err2: any) {
          logger.error(`Fallback AI also failed for compare summary: ${err2?.message ?? err2}`);
          summary = null;
        }
      }
    }

    if (!summary || !summary.trim()) {
      summary = this.deterministicFallback(input);
      logger.warn('Compare summary fell back to deterministic text (no AI available).');
    }

    const trimmed = summary.trim();
    this.cache.set(key, { summary: trimmed }, COMPARE_SUMMARY_TTL_MS);
    return { summary: trimmed, cached: false };
  }

  private deterministicFallback(input: CompareSummaryInput): string {
    const g1 = input.trainer1Gain;
    const g2 = input.trainer2Gain;
    const diff = g1 - g2;

    if (g1 === g2) {
      return `It's a Tie! ${input.trainer1Name} and ${input.trainer2Name} both gained ${formatGain(g1)} fans this ${input.period}. Evenly matched — keep pushing and the next stretch will decide it!`;
    }
    const winner = diff > 0 ? input.trainer1Name : input.trainer2Name;
    const loser = diff > 0 ? input.trainer2Name : input.trainer1Name;
    const absDiff = Math.abs(diff);
    return `${winner} leads this ${input.period} with ${formatGain(Math.max(g1, g2))} fans, ahead of ${loser} by ${absDiff.toLocaleString('en-US')}. A great effort from both trainers — stay consistent and the momentum will only grow!`;
  }
}

let _compareSummaryService: CompareSummaryService | null = null;

export function CreateCompareSummaryService(): CompareSummaryService {
  if (_compareSummaryService) return _compareSummaryService;

  const groqKey = process.env['GROQ_API_KEY'];
  if (groqKey) {
    const model = process.env['COMPARE_SUMMARY_MODEL'] || 'openai/gpt-oss-120b';
    const primary = createProvider('groq', groqKey, model);
    let fallback: AIService | null = null;
    try {
      fallback = createProvider('groq', groqKey, 'openai/gpt-oss-20b');
    } catch {
      fallback = null;
    }
    _compareSummaryService = new CompareSummaryService(primary, fallback);
  } else {
    const noop = {
      getCurrentModel: () => 'deterministic',
      generate: async () => '',
      generateStructuredOutput: async () => ({}),
    } as unknown as AIService;
    _compareSummaryService = new CompareSummaryService(noop, null);
    logger.warn('No GROQ_API_KEY — compare summaries will use deterministic fallback.');
  }

  return _compareSummaryService;
}
