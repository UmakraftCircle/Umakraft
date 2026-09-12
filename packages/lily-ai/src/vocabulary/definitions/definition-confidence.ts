import { Definition, DEFINITION_SOURCES } from './definition-source.js';

export type DefinitionConfidenceLevel = 'verified' | 'high' | 'moderate' | 'low';

export class DefinitionConfidenceEngine {
  /**
   * Retrieves the baseline confidence for a specific definition source.
   */
  public static getBaseConfidence(source: string): number {
    const s = source.toLowerCase();
    if (s.includes('curated') || s.includes('local')) {
      return DEFINITION_SOURCES.CURATED.confidence;
    }
    if (s.includes('wiktionary')) {
      return DEFINITION_SOURCES.WIKTIONARY.confidence;
    }
    if (s.includes('wordnet')) {
      return DEFINITION_SOURCES.WORDNET.confidence;
    }
    if (s.includes('learned') || s.includes('candidate')) {
      return DEFINITION_SOURCES.LEARNED.confidence;
    }
    return 0.75;
  }

  /**
   * Retrieves the baseline authority score for a definition source.
   */
  public static getBaseAuthority(source: string): number {
    const s = source.toLowerCase();
    if (s.includes('curated') || s.includes('local')) {
      return DEFINITION_SOURCES.CURATED.authority;
    }
    if (s.includes('wiktionary')) {
      return DEFINITION_SOURCES.WIKTIONARY.authority;
    }
    if (s.includes('wordnet')) {
      return DEFINITION_SOURCES.WORDNET.authority;
    }
    if (s.includes('learned') || s.includes('candidate')) {
      return DEFINITION_SOURCES.LEARNED.authority;
    }
    return 50;
  }

  /**
   * Calculates adjusted confidence based on contextual matching factors.
   */
  public static calculateConfidence(
    definition: Definition,
    options?: {
      context?: string;
      taxonomy?: string[];
      query?: string;
      partOfSpeech?: string;
    }
  ): number {
    let score = definition.confidence || this.getBaseConfidence(definition.source);

    if (!options) return Math.min(1.0, Math.max(0.0, score));

    // 1. Context matching
    if (options.context && definition.context) {
      const targetCtx = options.context.toLowerCase();
      const defCtx = definition.context.toLowerCase();
      if (defCtx === targetCtx || defCtx.includes(targetCtx) || targetCtx.includes(defCtx)) {
        score += 0.05;
      } else if (defCtx !== 'general' && targetCtx !== 'general') {
        score -= 0.15;
      }
    }

    // 2. Taxonomy alignment
    if (options.taxonomy && options.taxonomy.length > 0 && definition.tags) {
      const hasTaxonomyTag = options.taxonomy.some(tax =>
        definition.tags?.some(tag => tag.toLowerCase() === tax.toLowerCase())
      );
      if (hasTaxonomyTag) {
        score += 0.05;
      }
    }

    // 3. Query relevance
    if (options.query && definition.definition) {
      const queryWords = options.query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const defLower = definition.definition.toLowerCase();
      const matchCount = queryWords.filter(qw => defLower.includes(qw)).length;
      if (matchCount > 0) {
        score += Math.min(0.08, matchCount * 0.03);
      }
    }

    // 4. Part of speech match
    if (options.partOfSpeech && definition.partOfSpeech) {
      if (options.partOfSpeech.toLowerCase() === definition.partOfSpeech.toLowerCase()) {
        score += 0.03;
      } else {
        score -= 0.10;
      }
    }

    // 5. Examples richness
    if (definition.examples && definition.examples.length > 0) {
      score += 0.02;
    }

    return Number(Math.min(1.0, Math.max(0.0, score)).toFixed(4));
  }

  /**
   * Classifies a numerical confidence score into a qualitative band.
   */
  public static classify(confidence: number): DefinitionConfidenceLevel {
    if (confidence >= 0.95) return 'verified';
    if (confidence >= 0.85) return 'high';
    if (confidence >= 0.70) return 'moderate';
    return 'low';
  }

  /**
   * Evaluates if confidence meets the required threshold.
   */
  public static isSufficient(confidence: number, threshold = 0.70): boolean {
    return confidence >= threshold;
  }
}
