import { AnomalyResult } from './analytics-types.js';

export class AnomalyDetector {
  /**
   * Detects unusual deviations from average baselines.
   */
  public detectAnomaly(metric: string, baseline: number, observed: number): AnomalyResult {
    const ratio = observed / baseline;
    const isAnomaly = ratio > 2.5 || ratio < 0.2;
    const severity = ratio > 5.0 ? 'HIGH' : ratio > 2.5 ? 'MEDIUM' : 'LOW';

    return {
      metric,
      baseline,
      observed,
      isAnomaly,
      severity
    };
  }
}
