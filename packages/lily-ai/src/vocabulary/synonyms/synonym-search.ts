import { SynonymRegistry } from './synonym-registry.js';
import { SynonymResolver } from './synonym-resolver.js';
import { SynonymNormalizer } from './synonym-normalizer.js';
import {
  SynonymExpansionOptions,
  SynonymExpansionResult,
  SynonymLookupOptions,
  SynonymLookupResult
} from './synonym-entry.js';

export class SynonymSearch {
  private registry: SynonymRegistry;
  private resolver: SynonymResolver;

  constructor(registry: SynonymRegistry) {
    this.registry = registry;
    this.resolver = new SynonymResolver(registry);
  }

  /**
   * Finds synonyms for a single word.
   */
  public findSynonyms(word: string, options?: SynonymLookupOptions | string): string[] {
    const res = this.resolver.resolve(word, options);
    return res.found ? res.synonyms : [];
  }

  /**
   * F15.4 Search Expansion
   * Expands a multi-word or single-word query into synonymous variations and token terms.
   * Example: "quick runner" -> phrases: ["quick runner", "fast runner", "rapid runner", "swift runner"]
   * token expansions: quick -> [quick, fast, rapid, swift]
   */
  public expand(query: string, options?: SynonymExpansionOptions): SynonymExpansionResult {
    const opts: SynonymExpansionOptions = options || {};
    const maxPerTerm = opts.maxExpansionsPerTerm ?? 5;
    const minConfidence = opts.minConfidence ?? 0.60;
    const includeOriginal = opts.includeOriginal !== false;

    const rawTokens = SynonymNormalizer.tokenize(query);
    const tokenExpansions: Record<string, string[]> = {};
    const allExpandedTerms = new Set<string>();

    for (const token of rawTokens) {
      const res = this.resolver.resolve(token, {
        context: opts.context,
        minConfidence,
        limit: maxPerTerm
      });

      const termSynonyms = new Set<string>();
      if (includeOriginal) {
        termSynonyms.add(token);
        allExpandedTerms.add(token);
      }

      if (res.found && res.synonyms.length > 0) {
        for (const s of res.synonyms.slice(0, maxPerTerm)) {
          termSynonyms.add(s);
          allExpandedTerms.add(s);
        }
      }

      tokenExpansions[token] = Array.from(termSynonyms);
    }

    // Generate Cartesian/phrase permutations for multi-token queries
    const expandedPhrases = this.generatePhraseExpansions(rawTokens, tokenExpansions, 15);

    return {
      originalQuery: query,
      tokens: rawTokens,
      tokenExpansions,
      expandedTerms: Array.from(allExpandedTerms),
      expandedPhrases
    };
  }

  /**
   * Generates combinatorial phrase variations from token expansions.
   */
  private generatePhraseExpansions(
    tokens: string[],
    tokenExpansions: Record<string, string[]>,
    maxPhrases = 15
  ): string[] {
    if (tokens.length === 0) return [];
    if (tokens.length === 1) {
      return tokenExpansions[tokens[0]] || tokens;
    }

    const originalPhrase = tokens.join(' ');
    const phrases = new Set<string>([originalPhrase]);

    // For each token position, swap in synonyms while keeping others constant
    for (let i = 0; i < tokens.length; i++) {
      const currentToken = tokens[i];
      const syns = tokenExpansions[currentToken] || [];
      for (const syn of syns) {
        if (syn === currentToken) continue;
        const copy = [...tokens];
        copy[i] = syn;
        phrases.add(copy.join(' '));
        if (phrases.size >= maxPhrases) break;
      }
      if (phrases.size >= maxPhrases) break;
    }

    return Array.from(phrases);
  }

  /**
   * General substring / prefix search over registry entries.
   */
  public search(term: string, options?: { limit?: number }): SynonymLookupResult[] {
    const norm = SynonymNormalizer.normalize(term).normalized;
    const limit = options?.limit ?? 10;
    const results: SynonymLookupResult[] = [];

    const entries = this.registry.entries();
    for (const entry of entries) {
      if (entry.word.includes(norm) || entry.synonyms.some(s => s.includes(norm))) {
        results.push({
          found: true,
          word: entry.word,
          synonyms: entry.synonyms,
          relations: entry.relations || [],
          confidence: entry.confidence,
          context: entry.context
        });
        if (results.length >= limit) break;
      }
    }

    return results;
  }
}
