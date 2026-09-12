import { PredictionEngine } from './prediction-engine.js';
import { TrendEngine } from './trend-engine.js';
import { LeaderboardForecastEngine } from './leaderboard-forecast.js';
import { FanForecastEngine } from './fan-forecast.js';
import { ParentDemandForecast } from './parent-demand-forecast.js';
import { ClubHealthEngine } from './club-health-engine.js';
import { RiskDetector } from './risk-detector.js';
import { AnomalyDetector } from './anomaly-detector.js';
import { ClubHealth, FanPrediction, LeaderboardForecast, ParentDemandForecastResult, MetaPredictionResult, RiskAlert, AnomalyResult } from './analytics-types.js';

export class AnalyticsService {
  private predictionEngine = new PredictionEngine();
  private trendEngine = new TrendEngine();
  private leaderboardForecastEngine = new LeaderboardForecastEngine();
  private fanForecastEngine = new FanForecastEngine();
  private parentDemandForecast = new ParentDemandForecast();
  private clubHealthEngine = new ClubHealthEngine();
  private riskDetector = new RiskDetector();
  private anomalyDetector = new AnomalyDetector();

  public forecastMonthlyFans(currentFans: number, targetFans: number, daysRemaining: number, avgDailyGain: number): FanPrediction {
    return this.fanForecastEngine.forecastMonthlyFans(currentFans, targetFans, daysRemaining, avgDailyGain);
  }

  public forecastRank(currentRank: number, dailyGain: number): LeaderboardForecast {
    return this.leaderboardForecastEngine.forecastRank(currentRank, dailyGain);
  }

  public predictMetaShift(strategy: string, currentUsage: number): MetaPredictionResult {
    return this.trendEngine.predictMetaShift(strategy, currentUsage);
  }

  public forecastDemand(strategy: string, currentSupply: number, searchVolumeTrend: number): ParentDemandForecastResult {
    return this.parentDemandForecast.forecastDemand(strategy, currentSupply, searchVolumeTrend);
  }

  public calculateClubHealth(
    memberActivityRates: number[], 
    fanComplianceCount: number, 
    totalMembers: number, 
    parentCoveragePercent: number
  ): { score: number; health: ClubHealth } {
    return this.clubHealthEngine.calculateClubHealth(memberActivityRates, fanComplianceCount, totalMembers, parentCoveragePercent);
  }

  public detectRisks(missedTargetDays: number, activeDaysInactive: number, parentShortageCount: number): RiskAlert[] {
    return this.riskDetector.detectRisks(missedTargetDays, activeDaysInactive, parentShortageCount);
  }

  public detectAnomaly(metric: string, baseline: number, observed: number): AnomalyResult {
    return this.anomalyDetector.detectAnomaly(metric, baseline, observed);
  }

  public predictRecommendationSuccess(recommendationId: string, historySuccessRate?: number) {
    return this.predictionEngine.predictRecommendationSuccess(recommendationId, historySuccessRate);
  }
}
