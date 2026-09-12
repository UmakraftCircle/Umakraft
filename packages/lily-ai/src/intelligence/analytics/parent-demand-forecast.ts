import { ForecastConfidence, ParentDemandForecastResult } from './analytics-types.js';

export class ParentDemandForecast {
  /**
   * Predicts future supply-demand gap for breeding strategies.
   */
  public forecastDemand(strategy: string, currentSupply: number, searchVolumeTrend: number): ParentDemandForecastResult {
    const expectedDemand = Math.round(searchVolumeTrend * 1.6);
    const gap = expectedDemand - currentSupply;
    const shortageProbability = gap > 10 ? 0.85 : gap > 0 ? 0.45 : 0.05;

    return {
      strategy,
      currentSupply,
      expectedDemand,
      shortageProbability,
      confidence: ForecastConfidence.HIGH
    };
  }
}
