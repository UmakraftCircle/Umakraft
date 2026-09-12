export interface ConfidenceComponents {
  dictionary?: number;
  definition?: number;
  synonym?: number;
  antonym?: number;
  phrase?: number;
  vocabulary?: number;
  contextMatch?: number;
  isExact?: boolean;
  isCandidate?: boolean;
  subsystemCount?: number;
}

export class LexicalConfidenceAggregator {
  /**
   * Aggregates subsystem confidences into a final unified confidence score.
   */
  public aggregate(components: ConfidenceComponents): number {
    if (components.isCandidate) {
      // Candidates start with lower base confidence
      return Number(Math.min(0.55, (components.vocabulary || 0.42)).toFixed(2));
    }

    const availableScores: number[] = [];
    if (components.dictionary !== undefined) availableScores.push(components.dictionary);
    if (components.definition !== undefined) availableScores.push(components.definition);
    if (components.phrase !== undefined) availableScores.push(components.phrase);
    if (components.vocabulary !== undefined) availableScores.push(components.vocabulary);
    if (components.synonym !== undefined) availableScores.push(components.synonym);
    if (components.antonym !== undefined) availableScores.push(components.antonym);

    if (availableScores.length === 0) {
      return 0.40;
    }

    // Weighted average of available primary scores
    const maxScore = Math.max(...availableScores);
    const avgScore = availableScores.reduce((sum, val) => sum + val, 0) / availableScores.length;

    // Base score combines max and average
    let finalScore = (maxScore * 0.7) + (avgScore * 0.3);

    // Multi-subsystem agreement bonus (+0.02 per extra subsystem)
    if (availableScores.length >= 2) {
      finalScore += (availableScores.length - 1) * 0.02;
    }

    // Context match bonus
    if (components.contextMatch && components.contextMatch > 0.8) {
      finalScore += 0.03;
    }

    // Exact match bonus
    if (components.isExact) {
      finalScore += 0.02;
    }

    return Number(Math.min(0.99, Math.max(0.1, finalScore)).toFixed(2));
  }

  /**
   * Estimates overall semantic understanding score for a query/term.
   * Known Word + Known Definition + Known Context -> ~0.98
   * Partially known -> ~0.75
   * Unknown slang -> ~0.42
   */
  public calculateSemanticScore(
    hasDictionary: boolean,
    hasDefinition: boolean,
    hasContext: boolean,
    hasSynonyms: boolean,
    isCandidate: boolean
  ): number {
    if (isCandidate) {
      return 0.42;
    }

    let score = 0.50;
    if (hasDictionary) score += 0.20;
    if (hasDefinition) score += 0.18;
    if (hasSynonyms) score += 0.05;
    if (hasContext) score += 0.05;

    return Number(Math.min(0.99, score).toFixed(2));
  }
}
