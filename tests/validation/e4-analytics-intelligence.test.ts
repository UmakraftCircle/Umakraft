import { test } from 'node:test';
import assert from 'node:assert';
import { AnalyticsService, ForecastConfidence } from '../../packages/lily-ai/src/intelligence/analytics/index.js';

test('E4 — Advanced Analytics & Prediction Intelligence', async (t) => {
  const service = new AnalyticsService();

  await t.test('E4.1 Fan Prediction Engine', () => {
    // Current fans: 45M, target: 150M, days remaining: 15, daily gain: 3M -> Projected: 90M (missed)
    const result = service.forecastMonthlyFans(45_000_000, 150_000_000, 15, 3_000_000);
    assert.strictEqual(result.risk, 'HIGH');
    assert.strictEqual(result.probabilityOfFailure, 0.78);
    assert.strictEqual(result.confidence, ForecastConfidence.HIGH);
  });

  await t.test('E4.2 Leaderboard Forecasting', () => {
    // Slip down test
    const resultDown = service.forecastRank(25, -10);
    assert.strictEqual(resultDown.projectedRank, 41);
    assert.strictEqual(resultDown.trend, 'DOWN');

    // Climb up test
    const resultUp = service.forecastRank(25, 8);
    assert.strictEqual(resultUp.projectedRank, 12);
    assert.strictEqual(resultUp.trend, 'UP');
  });

  await t.test('E4.3 Club Health Calculations', () => {
    // Compliance = 28/30 = 93%, coverage = 81%, activity = 95%
    const { score, health } = service.calculateClubHealth([0.95, 0.95], 28, 30, 81);
    assert.strictEqual(health.fanCompliance, 93);
    assert.strictEqual(health.parentCoverage, 81);
    assert.strictEqual(health.activityLevel, 95);
    // Weighted score: 93*0.4 + 81*0.3 + 95*0.3 = 37.2 + 24.3 + 28.5 = 90
    assert.strictEqual(score, 90);
  });

  await t.test('E4.4 Parent Demand Forecasting', () => {
    // Current supply: 3, search trend: 15 -> expected demand: 24 (shortage likely)
    const result = service.forecastDemand('Long Distance End Closer', 3, 15);
    assert.strictEqual(result.currentSupply, 3);
    assert.strictEqual(result.expectedDemand, 24);
    assert.strictEqual(result.shortageProbability, 0.85);
  });

  await t.test('E4.5 Meta Forecasting', () => {
    // Current 58% -> projected 71%
    const result = service.predictMetaShift('Front Runner', 58);
    assert.strictEqual(result.projectedUsage, 71);
    assert.strictEqual(result.confidence, ForecastConfidence.MEDIUM);
  });

  await t.test('E4.6 Risk Detection', () => {
    const alerts = service.detectRisks(14, 0, 0);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].type, 'Fan Deficit Risk');
    assert.strictEqual(alerts[0].probabilityOfFailure, 0.82);
  });

  await t.test('E4.7 Anomaly Detection', () => {
    // Average baseline: 15 searches, today: 140 searches (spike)
    const result = service.detectAnomaly('Parent Searches', 15, 140);
    assert.strictEqual(result.isAnomaly, true);
    assert.strictEqual(result.severity, 'HIGH');
  });

  await t.test('E4.8 Recommendation Prediction (from D7)', () => {
    const result = service.predictRecommendationSuccess('rec_1', 0.8);
    assert.strictEqual(result.expectedSuccess, 0.74);
    assert.strictEqual(result.confidence, ForecastConfidence.HIGH);
  });
});
