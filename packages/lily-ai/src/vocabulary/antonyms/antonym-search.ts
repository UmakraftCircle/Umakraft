import { AntonymRegistry } from './antonym-registry.js';
import { AntonymResolver } from './antonym-resolver.js';
import { AntonymNormalizer } from './antonym-normalizer.js';
import {
  AntonymExpansionOptions,
  AntonymExpansionResult,
  AntonymLookupOptions,
  ContradictionCheckResult,
  ContradictionPair
} from './antonym-entry.js';

export class AntonymSearch {
  private registry: AntonymRegistry;
  private resolver: AntonymResolver;

  constructor(registry: AntonymRegistry) {
    this.registry = registry;
    this.resolver = new AntonymResolver(registry);
  }

  /**
   * Finds antonyms for a single word.
   */
  public findAntonyms(word: string, options?: AntonymLookupOptions | string): string[] {
    const res = this.resolver.resolve(word, options);
    return res.found ? res.antonyms : [];
  }

  /**
   * Checks if two words/terms are antonyms.
   */
  public areOpposites(wordA: string, wordB: string, context?: string): boolean {
    const normA = AntonymNormalizer.normalize(wordA);
    const normB = AntonymNormalizer.normalize(wordB);

    if (!normA.normalized || !normB.normalized || normA.normalized === normB.normalized) {
      return false;
    }

    // Direct check
    if (this.registry.areOpposites(normA.normalized, normB.normalized, context)) {
      return true;
    }

    // Lemma check
    if (this.registry.areOpposites(normA.lemma, normB.lemma, context)) {
      return true;
    }

    // Lookup antonyms of A
    const resA = this.resolver.resolve(normA.normalized, { context });
    if (resA.found && (resA.antonyms.includes(normB.normalized) || resA.antonyms.includes(normB.lemma))) {
      return true;
    }

    // Lookup antonyms of B
    const resB = this.resolver.resolve(normB.normalized, { context });
    if (resB.found && (resB.antonyms.includes(normA.normalized) || resB.antonyms.includes(normA.lemma))) {
      return true;
    }

    return false;
  }

  /**
   * F16.4 & F16.10 Search & Opposition Expansion
   * Expands a multi-word or single-word query into opposite variations and tokens.
   * Example: "speed increased" -> phrases: ["speed decreased", "speed dropped", "speed reduced"]
   */
  public expandOpposites(query: string, options?: AntonymExpansionOptions): AntonymExpansionResult {
    const opts: AntonymExpansionOptions = options || {};
    const maxPerTerm = opts.maxExpansionsPerTerm ?? 5;
    const minConfidence = opts.minConfidence ?? 0.60;

    const rawTokens = AntonymNormalizer.tokenize(query);
    const tokenAntonyms: Record<string, string[]> = {};
    const allOppositeTerms = new Set<string>();

    for (const token of rawTokens) {
      const res = this.resolver.resolve(token, {
        context: opts.context,
        minConfidence,
        limit: maxPerTerm
      });

      if (res.found && res.antonyms.length > 0) {
        tokenAntonyms[token] = res.antonyms.slice(0, maxPerTerm);
        for (const ant of tokenAntonyms[token]) {
          allOppositeTerms.add(ant);
        }
      } else {
        tokenAntonyms[token] = [];
      }
    }

    // Generate opposite phrase variations
    const oppositePhrases = this.generateOppositePhrases(rawTokens, tokenAntonyms, 15);

    return {
      originalQuery: query,
      tokens: rawTokens,
      tokenAntonyms,
      oppositeTerms: Array.from(allOppositeTerms),
      oppositePhrases
    };
  }

  /**
   * F16.5 Contradiction Detection between two statements.
   * Example: "Speed increased." vs "Speed decreased." -> { contradiction: true }
   * "Requirement Met" vs "Requirement Not Met" -> { contradiction: true }
   */
  public checkContradiction(
    statementA: string,
    statementB: string,
    context?: string
  ): ContradictionCheckResult {
    const tokensA = AntonymNormalizer.tokenize(statementA);
    const tokensB = AntonymNormalizer.tokenize(statementB);

    if (tokensA.length === 0 || tokensB.length === 0) {
      return { contradiction: false, confidence: 0, contradictoryPairs: [] };
    }

    const normA = statementA.toLowerCase().trim();
    const normB = statementB.toLowerCase().trim();

    // Check special negation patterns: "requirement met" vs "requirement not met" or "unmet"
    if (
      (normA.includes('met') && (normB.includes('not met') || normB.includes('unmet') || normB.includes('failed'))) ||
      (normB.includes('met') && (normA.includes('not met') || normA.includes('unmet') || normA.includes('failed')))
    ) {
      return {
        contradiction: true,
        confidence: 1.0,
        contradictoryPairs: [
          { termA: 'met', termB: normB.includes('not met') ? 'not met' : 'unmet', confidence: 1.0, context }
        ],
        explanation: `Contradiction detected: '${statementA}' directly opposes '${statementB}'`
      };
    }

    const contradictoryPairs: ContradictionPair[] = [];

    // Find antonym pairs across tokens of statementA and statementB
    for (const tA of tokensA) {
      for (const tB of tokensB) {
        if (this.areOpposites(tA, tB, context)) {
          const res = this.resolver.resolve(tA, { context });
          contradictoryPairs.push({
            termA: tA,
            termB: tB,
            confidence: res.found ? res.confidence : 0.90,
            context
          });
        }
      }
    }

    if (contradictoryPairs.length > 0) {
      const topConfidence = Math.max(...contradictoryPairs.map(p => p.confidence));
      return {
        contradiction: true,
        confidence: topConfidence,
        contradictoryPairs,
        explanation: `Contradictory opposite terms detected: ${contradictoryPairs.map(p => `${p.termA} vs ${p.termB}`).join(', ')}`
      };
    }

    return {
      contradiction: false,
      confidence: 0,
      contradictoryPairs: []
    };
  }

  /**
   * Generates opposite phrase variations by substituting tokens with their antonyms.
   */
  private generateOppositePhrases(
    tokens: string[],
    tokenAntonyms: Record<string, string[]>,
    maxPhrases = 15
  ): string[] {
    if (tokens.length === 0) return [];

    const phrases = new Set<string>();

    for (let i = 0; i < tokens.length; i++) {
      const currentToken = tokens[i];
      const ants = tokenAntonyms[currentToken] || [];
      for (const ant of ants) {
        const copy = [...tokens];
        copy[i] = ant;
        phrases.add(copy.join(' '));
        if (phrases.size >= maxPhrases) break;
      }
      if (phrases.size >= maxPhrases) break;
    }

    return Array.from(phrases);
  }
}
