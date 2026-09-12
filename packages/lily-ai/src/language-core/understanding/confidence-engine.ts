export interface ConfidenceScore {
  score: number;
  level: 'High' | 'Medium' | 'Low';
}

export class ConfidenceEngine {
  /**
   * Calculates overall understanding certainty based on ambiguity, context resolution, and vocabulary completeness
   */
  public calculate(params: {
    ambiguous: boolean;
    hasGoal: boolean;
    hasEmotion: boolean;
    contextResolved?: boolean;
    needsContext?: boolean;
    wordCount: number;
  }): ConfidenceScore {
    let score = 0.5; // Baseline

    if (params.hasGoal) {
      score += 0.2;
    }
    if (params.hasEmotion) {
      score += 0.1;
    }
    if (params.contextResolved) {
      score += 0.15;
    }
    if (params.needsContext) {
      score -= 0.15;
    }
    if (params.ambiguous) {
      score -= 0.3;
    }

    // Bound between 0 and 1
    score = Math.max(0.1, Math.min(score, 1.0));

    let level: 'High' | 'Medium' | 'Low' = 'Medium';
    if (score >= 0.8) {
      level = 'High';
    } else if (score < 0.5) {
      level = 'Low';
    }

    return { score, level };
  }
}
