export enum CorrectionConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export class CorrectionScorer {
  /**
   * Assigns confidence based on similarity score and distance
   */
  public scoreConfidence(similarity: number, distance: number): CorrectionConfidence {
    if (distance === 0) {
      return CorrectionConfidence.HIGH;
    }
    if (distance === 1 || similarity >= 0.85) {
      return CorrectionConfidence.HIGH;
    }
    if (distance === 2 || similarity >= 0.70) {
      return CorrectionConfidence.MEDIUM;
    }
    return CorrectionConfidence.LOW;
  }
}
