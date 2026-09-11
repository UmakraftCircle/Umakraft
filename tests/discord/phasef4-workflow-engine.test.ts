import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { workflowEngine } from '../../apps/discord/src/workflow-engine.js';

describe('Phase F4 — Autonomous Task Delegation & Workflow Engine Tests', () => {
  beforeEach(() => {
    workflowEngine.clearAll();
  });

  it('1. Registers and creates a fan goal tracking workflow successfully', () => {
    const wf = workflowEngine.createWorkflow({
      ownerId: 'trainer-001',
      ownerType: 'TRAINER',
      type: 'FAN_GOAL_TRACKING',
      goal: 'Reach 150M fans',
      targetValue: 150_000_000,
      initialValue: 128_000_000,
    });

    assert.ok(wf.workflowId);
    assert.equal(wf.state, 'ACTIVE');
    assert.equal(wf.targetValue, 150_000_000);
    assert.equal(wf.currentValue, 128_000_000);
  });

  it('2. Evaluates workflow and triggers milestone completion when target is reached', () => {
    const wf = workflowEngine.createWorkflow({
      ownerId: 'trainer-001',
      ownerType: 'TRAINER',
      type: 'FAN_GOAL_TRACKING',
      goal: 'Reach 150M fans',
      targetValue: 150_000_000,
      initialValue: 149_000_000,
    });

    const evalResult = workflowEngine.evaluateWorkflow(wf.workflowId, 150_000_000);
    assert.equal(evalResult.workflow.state, 'COMPLETED');
    assert.ok(evalResult.notification?.includes('Congratulations'));
  });

  it('3. Evaluates workflow deficit pacing and triggers AT_RISK state transition', () => {
    const wf = workflowEngine.createWorkflow({
      ownerId: 'trainer-002',
      ownerType: 'TRAINER',
      type: 'FAN_GOAL_TRACKING',
      goal: 'Reach 200M fans',
      targetValue: 200_000_000,
      initialValue: 50_000_000, // below expected 50% pacing (100M)
    });

    const evalResult = workflowEngine.evaluateWorkflow(wf.workflowId, 50_000_000);
    assert.equal(evalResult.workflow.state, 'AT_RISK');
    assert.ok(evalResult.notification?.includes('behind the required pace'));
  });

  it('4. Persists and retrieves workflows across state checks', () => {
    const wf = workflowEngine.createWorkflow({
      ownerId: 'trainer-003',
      ownerType: 'TRAINER',
      type: 'FAN_GOAL_TRACKING',
      goal: 'Reach 100M fans',
      targetValue: 100_000_000,
      initialValue: 80_000_000,
    });

    const retrieved = workflowEngine.getWorkflow(wf.workflowId);
    assert.ok(retrieved);
    assert.equal(retrieved?.goal, 'Reach 100M fans');

    const ownerWorkflows = workflowEngine.getWorkflowsForOwner('trainer-003');
    assert.equal(ownerWorkflows.length, 1);
  });
});
