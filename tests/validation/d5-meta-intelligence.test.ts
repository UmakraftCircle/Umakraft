import { test } from 'node:test';
import assert from 'node:assert';
import { CompetitionAdvisor } from '../../packages/lily-ai/src/intelligence/meta/competition-advisor.js';
import { MatchupAnalyzer } from '../../packages/lily-ai/src/intelligence/meta/matchup-analyzer.js';
import { CounterStrategyEngine } from '../../packages/lily-ai/src/intelligence/meta/counter-strategy.js';

test('D5 — Meta Intelligence', async (t) => {
  const compAdvisor = new CompetitionAdvisor();
  const matchupAnalyzer = new MatchupAnalyzer();
  const counterEngine = new CounterStrategyEngine();

  await t.test('D5.1 Competition Advice', () => {
    const adv = compAdvisor.adviseCompetition('CM');
    assert.strictEqual(adv.recommendedCharacter, 'Kitasan Black');
  });

  await t.test('D5.2 Matchup Analysis', () => {
    const adv = matchupAnalyzer.analyze('Oguri', 'Kitasan');
    assert.ok(adv.includes('Advantage'));
  });

  await t.test('D5.3 Counter Strategy', () => {
    const adv = counterEngine.suggest('High Density');
    assert.ok(adv.includes('Recommended'));
  });
});
