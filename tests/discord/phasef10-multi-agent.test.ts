import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { multiAgentOrchestrator } from '../../apps/discord/src/multi-agent-orchestrator.js';
import { workflowEngine } from '../../apps/discord/src/workflow-engine.js';
import { intentTranslator } from '../../apps/discord/src/intent-translator.js';
import { clubIntelligenceEngine } from '../../apps/discord/src/club-intelligence.js';
import { selfEvaluationEngine } from '../../apps/discord/src/self-evaluation.js';

describe('Phase F10 & S1 — Multi-Agent Architecture & Production Stabilization Tests', () => {
  beforeEach(() => {
    workflowEngine.clearAll();
    selfEvaluationEngine.clearLogs();
  });

  it('1. Router Agent routes character query to CHARACTER_SPECIALIST', () => {
    const agents = multiAgentOrchestrator.routeQuery('Tell me about Smart Falcon');
    assert.ok(agents.includes('CHARACTER_SPECIALIST'));
    assert.ok(agents.includes('PERSONALITY_COMPOSER'));
  });

  it('2. Router Agent routes fan query to FAN_ANALYST', () => {
    const agents = multiAgentOrchestrator.routeQuery('Can I reach 150M fans?');
    assert.ok(agents.includes('FAN_ANALYST'));
  });

  it('3. Router Agent routes mixed query to multiple specialists (Fan + Leaderboard)', () => {
    const agents = multiAgentOrchestrator.routeQuery('Can I reach 150M and what rank can I finish?');
    assert.ok(agents.includes('FAN_ANALYST'));
    assert.ok(agents.includes('LEADERBOARD_ANALYST'));
  });

  it('4. Production Stabilization: Natural Language Task Creation & Workflow Persistence', () => {
    const intentResult = intentTranslator.parseAndExecute('trainer-reg-1', 'Track my 200M goal.');
    assert.equal(intentResult.isAmbiguous, false);

    const workflows = workflowEngine.getWorkflowsForOwner('trainer-reg-1');
    assert.equal(workflows.length, 1);
    assert.equal(workflows[0].targetValue, 200_000_000);
  });

  it('5. Production Stabilization: Club Intelligence & Deficit Detection', () => {
    const report = clubIntelligenceEngine.generateReport([
      { trainerId: 't1', trainerName: 'Trainer A', currentFans: 100_000_000, targetFans: 150_000_000, dailyGain: 2_000_000, weeklyGain: 14_000_000, previousWeeklyGain: 15_000_000 },
    ], 10, 200_000_000);

    assert.equal(report.atRiskMembersCount, 1);
    assert.equal(report.clubHealth, 'WARNING' || 'CRITICAL' || 'GOOD');
  });

  it('6. Production Stabilization: Self-Evaluation Response Guardrail', () => {
    const evalResult = selfEvaluationEngine.evaluateResponse({
      userIntent: 'Tell me about Smart Falcon',
      draftResponse: 'Fan Gain Today: 5M fans.',
    });

    assert.equal(evalResult.passed, false);
    assert.ok(evalResult.failureReason?.includes('Intent validation failed'));
  });
});
