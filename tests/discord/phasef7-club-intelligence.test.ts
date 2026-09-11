import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clubIntelligenceEngine, ClubMemberRecord } from '../../apps/discord/src/club-intelligence.js';

describe('Phase F7 — Club Intelligence & Strategic Operations Engine Tests', () => {
  it('1. Projects month-end total accurately (3.5B + 120M * 10 days = 4.7B)', () => {
    const members: ClubMemberRecord[] = [
      { trainerId: 't1', trainerName: 'Trainer X', currentFans: 3_500_000_000, targetFans: 4_000_000_000, dailyGain: 120_000_000, weeklyGain: 840_000_000, previousWeeklyGain: 800_000_000 },
    ];

    const report = clubIntelligenceEngine.generateReport(members, 10, 5_000_000_000);
    assert.equal(report.projectedMonthEndTotal, 4_700_000_000);
  });

  it('2. Detects deficit risk for members projected below target', () => {
    const members: ClubMemberRecord[] = [
      { trainerId: 't1', trainerName: 'Trainer Safe', currentFans: 140_000_000, targetFans: 150_000_000, dailyGain: 5_000_000, weeklyGain: 35_000_000, previousWeeklyGain: 35_000_000 },
      { trainerId: 't2', trainerName: 'Trainer AtRisk', currentFans: 80_000_000, targetFans: 150_000_000, dailyGain: 1_000_000, weeklyGain: 7_000_000, previousWeeklyGain: 10_000_000 },
    ];

    const report = clubIntelligenceEngine.generateReport(members, 10, 300_000_000);
    assert.equal(report.atRiskMembersCount, 1);
    assert.deepEqual(report.atRiskMembers, ['Trainer AtRisk']);
  });

  it('3. Detects positive momentum from week-over-week gains', () => {
    const members: ClubMemberRecord[] = [
      { trainerId: 't1', trainerName: 'Trainer X', currentFans: 3_500_000_000, targetFans: 4_000_000_000, dailyGain: 120_000_000, weeklyGain: 900_000_000, previousWeeklyGain: 800_000_000 },
    ];

    const report = clubIntelligenceEngine.generateReport(members, 10, 5_000_000_000);
    assert.equal(report.momentum, 'POSITIVE');
  });

  it('4. Forecasts milestone completion days accurately', () => {
    const members: ClubMemberRecord[] = [
      { trainerId: 't1', trainerName: 'Trainer X', currentFans: 4_800_000_000, targetFans: 5_000_000_000, dailyGain: 50_000_000, weeklyGain: 350_000_000, previousWeeklyGain: 350_000_000 },
    ];

    const report = clubIntelligenceEngine.generateReport(members, 10, 5_000_000_000);
    // (5,000,000,000 - 4,800,000,000) / 50,000,000 = 4 days
    assert.equal(report.milestoneForecastDays, 4);
  });
});
