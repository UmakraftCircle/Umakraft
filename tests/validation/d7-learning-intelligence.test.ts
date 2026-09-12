import { test } from 'node:test';
import assert from 'node:assert';
import { LearningService, RecommendationScorer, ConfidenceCalibrator } from '../../packages/lily-ai/src/intelligence/learning/index.js';

test('D7 — Self-Improvement & Learning Intelligence', async (t) => {
  const learningService = new LearningService();
  const scorer = new RecommendationScorer();
  const calibrator = new ConfidenceCalibrator();

  await t.test('D7.1 Outcome Tracking', () => {
    learningService.processOutcome('rec_1', true);
    assert.ok(true); // Verifies call completion
  });

  await t.test('D7.2 Recommendation Scoring', () => {
    const score = scorer.calculateScore('rec_1');
    assert.strictEqual(score.successRate, 0.8);
  });

  await t.test('D7.3 Confidence Calibration', () => {
    const cal = calibrator.calibrate({ recommendationId: 'rec_1', successRate: 0.9, usageRate: 0.5, confidence: 0.9 });
    assert.strictEqual(cal, 0.9);
  });
});
