import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  FanLeaderboardResolver,
  FanIntentDetector,
  ScopeResolver,
  LeaderboardQueryService,
  DMResponseFormatter,
} from '@ai-agent-platform/core';

describe('Phase 15: Fan Gain & Ecosystem Scope Resolution', () => {
  it('1. Resolves default scope to unified daily top 10', () => {
    const resolver = new FanLeaderboardResolver();
    const resolution = resolver.resolveScope('Show fan leaderboard');

    assert.strictEqual(resolution.scope, 'unified');
    assert.strictEqual(resolution.period, 'daily');
    assert.strictEqual(resolution.limit, 10);
  });

  it('2. Resolves Umakraft 2 ecosystem scope correctly', () => {
    const resolver = new FanLeaderboardResolver();
    const resolution = resolver.resolveScope('Show Umakraft 2 weekly leaderboard top 25');

    assert.strictEqual(resolution.scope, 'umakraft2');
    assert.strictEqual(resolution.period, 'weekly');
    assert.strictEqual(resolution.limit, 25);
  });

  it('3. Resolves Umakraft ecosystem scope correctly', () => {
    const resolver = new FanLeaderboardResolver();
    const resolution = resolver.resolveScope('How many fans did I gain on Umakraft today?');

    assert.strictEqual(resolution.scope, 'umakraft');
    assert.strictEqual(resolution.period, 'daily');
  });

  it('4. Queries leaderboard records by separate ecosystem storage', async () => {
    const resolver = new FanLeaderboardResolver();
    await resolver.init();

    await resolver.recordFanGain('user_1', 'TrainerOne', 'umakraft', 'daily', 500000);
    await resolver.recordFanGain('user_2', 'TrainerTwo', 'umakraft2', 'daily', 750000);

    const umaLeaderboard = await resolver.getLeaderboard('umakraft', 'daily', 5);
    const uma2Leaderboard = await resolver.getLeaderboard('umakraft2', 'daily', 5);

    assert.ok(umaLeaderboard.some((t) => t.trainerName === 'TrainerOne'));
    assert.ok(uma2Leaderboard.some((t) => t.trainerName === 'TrainerTwo'));
  });

  it('5. FanIntentDetector classifies fan gain vs leaderboard queries and rejects false positives (Smart Falcon, Fantastic, etc.)', () => {
    // Valid Fan Gain
    assert.strictEqual(FanIntentDetector.detectIntent('how many fans did I gain'), 'fan_gain');
    assert.strictEqual(FanIntentDetector.detectIntent('my fan gain'), 'fan_gain');
    assert.strictEqual(FanIntentDetector.detectIntent('fans today'), 'fan_gain');
    assert.strictEqual(FanIntentDetector.detectIntent('show my fan gain'), 'fan_gain');
    assert.strictEqual(FanIntentDetector.detectIntent('fan gain today'), 'fan_gain');
    assert.strictEqual(FanIntentDetector.detectIntent('my fans today'), 'fan_gain');

    // Valid Leaderboard
    assert.strictEqual(FanIntentDetector.detectIntent('show leaderboard'), 'leaderboard');
    assert.strictEqual(FanIntentDetector.detectIntent('top 10 trainers'), 'leaderboard');
    assert.strictEqual(FanIntentDetector.detectIntent('rankings today'), 'leaderboard');
    assert.strictEqual(FanIntentDetector.detectIntent('fan leaderboard'), 'leaderboard');
    assert.strictEqual(FanIntentDetector.detectIntent('top trainers'), 'leaderboard');
    assert.strictEqual(FanIntentDetector.detectIntent('my rank'), 'leaderboard');

    // False Positive Rejections (Must route to chat / none)
    assert.strictEqual(FanIntentDetector.detectIntent('Smart Falcon is amazing'), 'none');
    assert.strictEqual(FanIntentDetector.detectIntent('She loves her fans'), 'none');
    assert.strictEqual(FanIntentDetector.detectIntent('Fantastic race'), 'none');
    assert.strictEqual(FanIntentDetector.detectIntent('Fancy support card'), 'none');
    assert.strictEqual(FanIntentDetector.detectIntent('Falcon is my favorite'), 'none');
  });

  it('6. ScopeResolver resolves ecosystem, period, and limit', () => {
    const res = ScopeResolver.resolveScope('top 50 Umakraft 2 monthly leaderboard');
    assert.strictEqual(res.scope, 'umakraft2');
    assert.strictEqual(res.period, 'monthly');
    assert.strictEqual(res.limit, 50);
  });

  it('7. LeaderboardQueryService manages user ranks and fan gains', async () => {
    const service = new LeaderboardQueryService();
    await service.init();

    await service.recordFanGain('trainer_x', 'Trainer X', 'unified', 'daily', 999000);
    const userRankData = await service.getUserRank('trainer_x', 'unified', 'daily');

    assert.ok(userRankData.rank >= 1);
    assert.ok(userRankData.fanGain >= 999000);
  });

  it('8. DMResponseFormatter generates user-first formatted responses', () => {
    const scopeRes = { scope: 'unified' as const, period: 'daily' as const, limit: 10 };
    const userRankData = { rank: 7, fanGain: 1245300 };
    const entries = [{ trainerName: 'TrainerA', fanGain: 3550000 }];

    const formattedFanGain = DMResponseFormatter.formatResponse(
      'fan_gain',
      scopeRes,
      userRankData,
      entries
    );
    assert.ok(formattedFanGain.includes('📈 Fan Gain Summary'));
    assert.ok(formattedFanGain.includes('1,245,300'));
    assert.ok(formattedFanGain.includes('#7'));

    const formattedLeaderboard = DMResponseFormatter.formatResponse(
      'leaderboard',
      scopeRes,
      userRankData,
      entries
    );
    assert.ok(formattedLeaderboard.includes('🏆 Unified Daily Fan Gain Leaderboard'));
    assert.ok(formattedLeaderboard.includes('Your Rank:\n#7'));
    assert.ok(formattedLeaderboard.includes('#1 TrainerA — 3,550,000'));
  });
});
