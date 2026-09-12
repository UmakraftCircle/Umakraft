import { TrustLevel } from './federation-types.js';

export class TrustEngine {
  /**
   * Retrieves weighting or scores for participating federation nodes based on trust levels.
   */
  public getWeightMultiplier(level: TrustLevel): number {
    switch (level) {
      case TrustLevel.VERIFIED:
        return 1.0;
      case TrustLevel.TRUSTED:
        return 0.8;
      case TrustLevel.COMMUNITY:
        return 0.50;
      case TrustLevel.UNKNOWN:
        return 0.25;
      default:
        return 0.0;
    }
  }

  /**
   * Evaluates trust level from score
   */
  public getTrustLevelFromScore(score: number): TrustLevel {
    if (score >= 90) return TrustLevel.VERIFIED;
    if (score >= 70) return TrustLevel.TRUSTED;
    if (score >= 40) return TrustLevel.COMMUNITY;
    return TrustLevel.UNKNOWN;
  }
}
