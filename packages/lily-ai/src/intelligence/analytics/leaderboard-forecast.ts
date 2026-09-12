import { ForecastConfidence, LeaderboardForecast } from './analytics-types.js';

export class LeaderboardForecastEngine {
  /**
   * Projects rank based on current position and momentum
   */
  public forecastRank(currentRank: number, dailyGain: number): LeaderboardForecast {
    let projectedRank = currentRank;
    let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';

    if (dailyGain > 5) {
      projectedRank = Math.max(1, currentRank - 13); // climbing up
      trend = 'UP';
    } else if (dailyGain < -5) {
      projectedRank = currentRank + 16; // slipping down
      trend = 'DOWN';
    }

    return {
      currentRank,
      projectedRank,
      confidence: ForecastConfidence.HIGH,
      trend
    };
  }
}
