export enum SynonymConfidenceLevel {
  EXACT_EQUIVALENT = 1.00,
  STRONG_SYNONYM = 0.90,
  CONTEXTUAL_SYNONYM = 0.75,
  RELATED_NEAR_SYNONYM = 0.50,
  WEAK_ASSOCIATION = 0.30
}

export type SynonymClassification = 'direct' | 'close' | 'related' | 'distant';

export class SynonymConfidenceEngine {
  /**
   * Classifies a confidence score into standard synonym classification.
   */
  public static classify(confidence: number): SynonymClassification {
    if (confidence >= 0.90) return 'direct';
    if (confidence >= 0.75) return 'close';
    if (confidence >= 0.50) return 'related';
    return 'distant';
  }

  /**
   * Checks whether a relationship passes the required confidence threshold.
   */
  public static isSufficient(confidence: number, minConfidence = 0.50): boolean {
    return confidence >= minConfidence;
  }

  /**
   * Adjusts confidence score based on context match.
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
