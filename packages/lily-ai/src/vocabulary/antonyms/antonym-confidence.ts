export enum AntonymConfidenceLevel {
  EXACT_OPPOSITE = 1.00,
  STRONG_ANTONYM = 0.90,
  CONTEXTUAL_ANTONYM = 0.75,
  MODERATE_OPPOSITE = 0.50,
  WEAK_CONTRAST = 0.30
}

export type AntonymClassification = 'direct' | 'strong' | 'moderate' | 'weak';

export class AntonymConfidenceEngine {
  /**
   * Classifies a confidence score into standard antonym classification.
   */
  public static classify(confidence: number): AntonymClassification {
    if (confidence >= 0.90) return 'direct';
    if (confidence >= 0.75) return 'strong';
    if (confidence >= 0.50) return 'moderate';
    return 'weak';
  }

  /**
   * Checks whether an antonym relationship passes the minimum threshold.
   */
  public static isSufficient(confidence: number, minConfidence = 0.50): boolean {
    return confidence >= minConfidence;
  }

  /**
   * Adjusts confidence score based on contextual match.
   */
  public static calculateConfidence(
    baseConfidence: number,
    itemContext?: string,
    queryContext?: string
  ): number {
    if (!queryContext || !itemContext) {
      return baseConfidence;
    }
    const normItem = itemContext.trim().toLowerCase();
    const normQuery = queryContext.trim().toLowerCase();

    if (normItem === normQuery) {
      return Math.min(1.0, baseConfidence + 0.1);
    }

    // Context mismatch penalty
    return Math.max(0.1, baseConfidence - 0.4);
  }
}
