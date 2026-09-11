import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { observabilityService } from '../../apps/discord/src/observability.js';
import { IntentType } from '../../apps/discord/src/intent-router.js';

describe('H1 — Observability & Telemetry Tests', () => {
  it('1. Starts trace and logs full lifecycle steps correctly', () => {
    const trace = observabilityService.startTrace('user-999');
    assert.ok(trace.traceId.startsWith('REQ-'));
    assert.equal(trace.userId, 'user-999');

    observabilityService.logIntent(trace.traceId, IntentType.FAN_SYSTEM, 0.98, 'RULE_MATCH');
    observabilityService.logContext(trace.traceId, ['Trainer Profile', 'Fan Statistics'], ['Handbook', 'Leaderboard'], 1342);
    observabilityService.logMemory(trace.traceId, ['favoriteUma', 'trainerName'], 2);
    observabilityService.logCache(trace.traceId, 'MISS');
    observabilityService.logTool(trace.traceId, 'FanGainTool', true, 38);
    observabilityService.logModel(trace.traceId, 'llama-3.3-70b', 'Groq', 2500, 300, 1200);
    observabilityService.logEvaluator(trace.traceId, true, 96, []);
    observabilityService.finalizeTrace(trace.traceId, 'SENT');

    const retrieved = observabilityService.getTrace(trace.traceId);
    assert.ok(retrieved);
    assert.equal(retrieved?.intent, IntentType.FAN_SYSTEM);
    assert.equal(retrieved?.evaluationScore, 96);
    assert.equal(retrieved?.outcome, 'SENT');
  });

  it('2. Generates health report summary', () => {
    const report = observabilityService.getHealthReport();
    assert.ok(report.includes('=== Lily Health Report ==='));
  });
});
