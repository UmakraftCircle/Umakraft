import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MultiToolPlanner } from '../../apps/discord/src/multi-tool-planner.js';

describe('Phase F3 — Multi-Tool Reasoning & Task Execution Engine Tests', () => {
  const planner = new MultiToolPlanner(5, 10);

  it('1. Generates correct multi-step plan for Fan Pace query ("Am I on track for 150M?")', () => {
    const plan = planner.createPlan('Am I on track for 150M fans this month?');
    assert.equal(plan.goal, 'Check fan pace and calculate required progress');
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.steps[0].toolName, 'FAN_SYSTEM');
    assert.equal(plan.steps[1].toolName, 'CALCULATION_ENGINE');
    assert.equal(plan.steps[2].toolName, 'CHAT_ENGINE');
  });

  it('2. Generates correct multi-step plan for Leaderboard Comparison ("How far am I from rank 1?")', () => {
    const plan = planner.createPlan('How far am I from rank 1?');
    assert.equal(plan.goal, 'Compare user rank against top leaderboard trainers');
    assert.equal(plan.steps.length, 4);
    assert.equal(plan.steps[0].toolName, 'FAN_SYSTEM');
    assert.equal(plan.steps[1].toolName, 'LEADERBOARD_SYSTEM');
    assert.equal(plan.steps[2].toolName, 'CALCULATION_ENGINE');
    assert.equal(plan.steps[3].toolName, 'CHAT_ENGINE');
  });

  it('3. Generates correct multi-step plan for Linking Help ("How do I get linked?")', () => {
    const plan = planner.createPlan('How do I get linked?');
    assert.equal(plan.goal, 'Provide account linking instructions and leadership contact info');
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.steps[0].toolName, 'HANDBOOK_SEARCH');
    assert.equal(plan.steps[1].toolName, 'CLUB_DATA');
    assert.equal(plan.steps[2].toolName, 'CHAT_ENGINE');
  });

  it('4. Executes execution graph with shared working memory successfully', async () => {
    const plan = planner.createPlan('Am I on track for 150M fans this month?');
    const result = await planner.executePlan(plan, {});

    assert.equal(result.success, true);
    assert.equal(result.stepResults.length, 3);
    assert.ok(result.workingMemory['step_1']);
    assert.ok(result.workingMemory['step_2']);
    assert.equal(result.workingMemory['step_1'].fanTotal, 128000000);
  });

  it('5. Enforces safety boundaries and blocks unauthorized actions', async () => {
    const maliciousPlan = {
      goal: 'Unauthorized delete action',
      steps: [
        { stepId: 'step_1', toolName: 'ADMIN_DELETE', description: 'Attempt to delete database' },
      ],
      maxSteps: 5,
      maxToolCalls: 10,
    };

    const result = await planner.executePlan(maliciousPlan, {});
    assert.equal(result.success, false);
    assert.equal(result.stepResults[0].success, false);
    assert.ok(result.stepResults[0].error?.includes('safety boundaries'));
  });
});
