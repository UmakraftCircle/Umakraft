import { ClubHealth } from './analytics-types.js';

export class ClubHealthEngine {
  /**
   * Evaluates overall club health score and individual metrics.
   */
  public calculateClubHealth(
    memberActivityRates: number[], 
    fanComplianceCount: number, 
    totalMembers: number, 
    parentCoveragePercent: number
  ): { score: number; health: ClubHealth } {
    const activityLevel = Math.round((memberActivityRates.reduce((a, b) => a + b, 0) / memberActivityRates.length) * 100);
    const fanCompliance = Math.round((fanComplianceCount / totalMembers) * 100);
    const parentCoverage = Math.round(parentCoveragePercent);
    
    // Overall Health Score (weighted average)
    const score = Math.round(
      (fanCompliance * 0.4) + 
      (parentCoverage * 0.3) + 
      (activityLevel * 0.3)
    );

    const growthScore = score > 85 ? 90 : score > 70 ? 75 : 50;

    return {
      score,
      health: {
        memberHealth: score,
        fanCompliance,
        parentCoverage,
        activityLevel,
        growthScore
      }
    };
  }
}
