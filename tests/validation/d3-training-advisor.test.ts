import { test } from 'node:test';
import assert from 'node:assert';
import { TrainingAdvisor } from '../../packages/lily-ai/src/advisors/training/training-advisor.js';
import { EventAdvisor } from '../../packages/lily-ai/src/advisors/training/event-advisor.js';
import { SkillPurchaseAdvisor } from '../../packages/lily-ai/src/advisors/training/skill-purchase-advisor.js';

test('D3 — Training Advisor Engine', async (t) => {
  const advisor = new TrainingAdvisor();
  const eventAdvisor = new EventAdvisor();
  const skillAdvisor = new SkillPurchaseAdvisor();

  await t.test('D3.1 Energy/Training Advice', () => {
    const rec = advisor.getAdvice({
      character: 'Kitasan Black',
      scenario: 'UAF',
      turn: 1,
      energy: 18,
      mood: 'Good',
      stats: { speed: 100, stamina: 100, power: 100, guts: 100, wisdom: 100 },
      supportCards: []
    });
    assert.strictEqual(rec.action, 'Speed Training');
  });

  await t.test('D3.2 Event Advice', () => {
    const rec = eventAdvisor.advise('Kitasan Event');
    assert.strictEqual(rec.recommendedAction, 'Option A');
  });

  await t.test('D3.3 Skill Purchase Advice', () => {
    const rec = skillAdvisor.advise(['Concentration'], 100);
    assert.ok(rec.priority.length > 0);
  });
});
