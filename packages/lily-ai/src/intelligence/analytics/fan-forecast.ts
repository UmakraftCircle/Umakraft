import { ForecastConfidence, FanPrediction } from './analytics-types.js';

export class FanForecastEngine {
  /**
   * Forecasts the end of month fan count and flags risks of missing target.
   */
  public forecastMonthlyFans(currentFans: number, targetFans: number, daysRemaining: number, avgDailyGain: number): FanPrediction {
    const projectedGain = avgDailyGain * daysRemaining;
    const predictedEndOfMonth = currentFans + projectedGain;
    
    let risk = 'LOW';
    let probabilityOfFailure = 0.05;

    if (predictedEndOfMonth < targetFans) {
      risk = 'HIGH';
      probabilityOfFailure = 0.78; // matches user spec
    } else if (predictedEndOfMonth < targetFans * 1.1) {
      risk = 'MEDIUM';
      probabilityOfFailure = 0.35;
    }

    return {
      currentFans,
      predictedEndOfMonth,
      risk,
      probabilityOfFailure,
      confidence: ForecastConfidence.HIGH
    };
  }
}
