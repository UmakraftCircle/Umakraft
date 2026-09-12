export interface ConfidenceFactors {
  frequency: number;
  consistency?: number;
  sourceQuality?: number;
  patternStrength?: number;
}
export type LearningConfidenceFactors = ConfidenceFactors;

export class ConfidenceEngine {
  /**
   * Evaluates learning confidence between 0.0 and 1.0 based on:
   * - Frequency (logarithmic/linear scaling)
   * - Consistency (0.0 to 1.0)
   * - Source Quality (0.0 to 1.0)
   * - Pattern Strength (0.0 to 1.0)
   */
  public evaluate(factors: ConfidenceFactors): number {
    const {
      frequency,
      consistency = 0.9,
      sourceQuality = 0.9,
      patternStrength = 0.85
    } = factors;

    if (frequency <= 0) return 0;

    // Base confidence from frequency
    // Frequency thresholds:
    // >= 100 observations: 0.90+ base
    // 50-99 observations: 0.80 - 0.89 base
    // 20-49 observations: 0.70 - 0.79 base
    // < 20 observations: < 0.70 base
    let baseConfidence = 0.5;
    if (frequency >= 200) {
      baseConfidence = 0.96;
    } else if (frequency >= 100) {
      baseConfidence = 0.92;
    } else if (frequency >= 50) {
      baseConfidence = 0.82;
    } else if (frequency >= 20) {
      baseConfidence = 0.72;
    } else if (frequency >= 10) {
      baseConfidence = 0.60;
    } else {
      baseConfidence = 0.30 + (frequency * 0.02);
    }

    // Weight combination: Base (50%), Consistency (25%), SourceQuality (15%), PatternStrength (10%)
    const score = (
      baseConfidence * 0.50 +
      consistency * 0.25 +
      sourceQuality * 0.15 +
      patternStrength * 0.10
    );

    return Math.min(1.0, Math.max(0.0, Number(score.toFixed(2))));
  }

  /**
   * Returns recommendation action based on confidence thresholds:
   * 0.90+ -> Candidate
   * 0.70 - 0.89 -> Observe Longer
   * Below 0.70 -> Ignore
   */
  public getRecommendation(confidence: number): 'candidate' | 'observe_longer' | 'ignore' {
    if (confidence >= 0.90) return 'candidate';
    if (confidence >= 0.70) return 'observe_longer';
    return 'ignore';
  }
}
