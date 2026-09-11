import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { selfEvaluationEngine } from '../../apps/discord/src/self-evaluation.js';

describe('Phase F9 — Agent Self-Evaluation & Response Validation Engine Tests', () => {
  beforeEach(() => {
    selfEvaluationEngine.clearLogs();
  });

  it('1. Detects Intent Validation Failure (Smart Falcon query returning leaderboard data)', () => {
    const result = selfEvaluationEngine.evaluateResponse({
      userIntent: 'Tell me about Smart Falcon',
      draftResponse: 'Fan Gain Today: 4.2M fans across the club leaderboard.',
    });

    assert.equal(result.passed, false);
    assert.ok(result.failureReason?.includes('Intent validation failed'));
  });

  it('2. Detects Hallucination Validation Failure (Unverified patch notes without search)', () => {
    const result = selfEvaluationEngine.evaluateResponse({
      userIntent: 'Latest Global Patch Notes',
      draftResponse: 'Patch 3.2 added new dirt tracks and balance changes.',
      requiresSearch: true,
      searchPerformed: false,
    });

    assert.equal(result.passed, false);
    assert.ok(result.failureReason?.includes('Hallucination validation failed'));
  });

  it('3. Detects Personality Validation Failure (Robotic system response)', () => {
    const result = selfEvaluationEngine.evaluateResponse({
      userIntent: 'How do I link my account?',
      draftResponse: 'Request processed successfully. Operation completed.',
    });

    assert.equal(result.passed, false);
    assert.ok(result.failureReason?.includes('Personality validation failed'));
  });

  it('4. Approves high-quality compliant responses', () => {
    const result = selfEvaluationEngine.evaluateResponse({
      userIntent: 'Tell me about Smart Falcon',
      draftResponse: 'Of course, Trainer! Smart Falcon is a leading dirt runner known for her iconic front-running style and idol performances!',
      conversationTopic: 'Smart Falcon',
    });

    assert.equal(result.passed, true);
    assert.ok(result.overall >= 75);
  });
});
