import { test } from 'node:test';
import assert from 'node:assert';
import { CareerPlanner } from '../../packages/lily-ai/src/advisors/career/career-planner.js';
import { TeamBuilder } from '../../packages/lily-ai/src/advisors/career/team-builder.js';

test('D4 — Career Planner & Team Builder', async (t) => {
  const planner = new CareerPlanner();
  const teamBuilder = new TeamBuilder();

  await t.test('D4.1 Full Career Plan', () => {
    const plan = planner.plan('Kitasan Black', 'Long Front Runner', 'Front Runner');
    assert.strictEqual(plan.character, 'Kitasan Black');
    assert.ok(plan.milestones.length > 0);
  });

  await t.test('D4.2 Team Builder', () => {
    const team = teamBuilder.recommendTeam('Nakayama', 'Long');
    assert.ok(team.length > 0);
  });
});
