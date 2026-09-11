import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { insightEngine } from '../../apps/discord/src/insight-engine.js';

describe('Phase F5 — Proactive Intelligence Engine Tests', () => {
  beforeEach(() => {
    insightEngine.clearCooldowns();
  });

  it('1. Detects surplus opportunity when gain exceeds target pace by 20%', () => {
    const { insight, suppressed } = insightEngine.evaluateTrainerMetrics({
      trainerId: 'trainer-001',
      trainerName: 'Jayson',
      currentFans: 130_000_000,
      targetFans: 150_000_000,
      dailyGain: 6_000_000,
      requiredDailyGain: 4_000_000,
      currentRank: 5,
      previousRank: 5,
      consecutiveDaysBelowTarget: 0,
    });

    assert.equal(suppressed, false);
    assert.equal(insight?.category, 'SURPLUS_OPPORTUNITY');
    assert.equal(insight?.priority, 'HIGH');
    assert.ok(insight?.message.includes('22% above the pace'));
  });

  it('2. Detects deficit risk when gain is below target for 3 consecutive days', () => {
    const { insight, suppressed } = insightEngine.evaluateTrainerMetrics({
      trainerId: 'trainer-002',
      trainerName: 'Apex',
      currentFans: 110_000_000,
      targetFans: 150_000_000,
      dailyGain: 2_000_000,
      requiredDailyGain: 5_000_000,
      currentRank: 10,
      previousRank: 10,
      consecutiveDaysBelowTarget: 3,
    });

    assert.equal(suppressed, false);
    assert.equal(insight?.category, 'DEFICIT_RISK');
    assert.equal(insight?.priority, 'CRITICAL');
    assert.ok(insight?.message.includes('fallen below the pace'));
  });

  it('3. Detects ranking change opportunity', () => {
    const { insight, suppressed } = insightEngine.evaluateTrainerMetrics({
      trainerId: 'trainer-003',
      trainerName: 'Swift',
      currentFans: 140_000_000,
      targetFans: 150_000_000,
      dailyGain: 4_000_000,
      requiredDailyGain: 4_000_000,
      currentRank: 4,
      previousRank: 6,
    });

    assert.equal(suppressed, false);
    assert.equal(insight?.category, 'RANKING_CHANGE');
    assert.equal(insight?.priority, 'MEDIUM');
    assert.ok(insight?.message.includes('rank #6 to #4'));
  });

  it('4. Enforces cooldown protection and suppresses duplicate insights within cooldown window', () => {
    const metrics = {
      trainerId: 'trainer-004',
      trainerName: 'Runner',
      currentFans: 100_000_000,
      targetFans: 150_000_000,
      dailyGain: 1_000_000,
      requiredDailyGain: 5_000_000,
      currentRank: 12,
      previousRank: 12,
      consecutiveDaysBelowTarget: 3,
    };

    // First evaluation -> Insight generated
    const first = insightEngine.evaluateTrainerMetrics(metrics);
    assert.equal(first.suppressed, false);
    assert.ok(first.insight);

    // Second evaluation immediately -> Suppressed by cooldown
    const second = insightEngine.evaluateTrainerMetrics(metrics);
    assert.equal(second.suppressed, true);
    assert.equal(second.insight, undefined);
  });

  it('5. Generates daily intelligence digest summary successfully', () => {
    const digest = insightEngine.generateDailyDigest({
      trainerName: 'Jayson',
      currentFans: 132_000_000,
      targetFans: 150_000_000,
      dailyGain: 5_200_000,
      requiredDailyGain: 4_000_000,
      rank: 5,
      rankDelta: 1,
    });

    assert.ok(digest.includes("Good morning, Jayson!"));
    assert.ok(digest.includes("132.0M"));
    assert.ok(digest.includes("Ahead by 1.2M"));
    assert.ok(digest.includes("#5 (+1 since yesterday)"));
  });
});
