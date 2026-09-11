import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lilyOrchestrator } from '../../apps/discord/src/lily-orchestrator.js';
import { observabilityService } from '../../apps/discord/src/observability.js';
import { IntentType } from '../../apps/discord/src/intent-router.js';

describe('H2 — Architecture Refactor & Orchestrator Tests', () => {
  it('1. Orchestrates FAN_SYSTEM query end-to-end with trace logging and tool execution', () => {
    const response = lilyOrchestrator.handleMessage({
      userId: 'trainer-h2-1',
      message: 'What is my fan gain today?',
    });

    assert.ok(response.reply.includes('current fan count'));
    assert.ok(response.traceId.startsWith('REQ-'));
    assert.equal(response.evaluation.passed, true);

    const trace = observabilityService.getTrace(response.traceId);
    assert.ok(trace);
    assert.equal(trace?.intent, IntentType.FAN_SYSTEM);
    assert.equal(trace?.cacheStatus, 'MISS');
    assert.equal(trace?.outcome, 'SENT');
  });

  it('2. Demonstrates cache hit on second identical request', () => {
    const msg = 'What are the club handbook requirements?';
    const resp1 = lilyOrchestrator.handleMessage({
      userId: 'trainer-h2-2',
      message: msg,
    });

    const resp2 = lilyOrchestrator.handleMessage({
      userId: 'trainer-h2-2',
      message: msg,
    });

    assert.equal(resp2.evaluation.passed, true);
    const trace2 = observabilityService.getTrace(resp2.traceId);
    assert.equal(trace2?.cacheStatus, 'HIT');
  });
});
