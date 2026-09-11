import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { responseEvaluatorService } from '../../apps/discord/src/response-evaluator.js';
import { IntentType } from '../../apps/discord/src/intent-router.js';

describe('G5 — Response Evaluator & Quality Gate Tests', () => {
  it('1. Blocks wrong-topic cross-domain answers (Yamanin Zephyr bust size -> Queen Elizabeth track)', () => {
    const result = responseEvaluatorService.evaluate({
      userMessage: "What is Yamanin Zephyr's bust size?",
      expectedIntent: IntentType.CHAT,
      generatedResponse: "Queen Elizabeth Cup track layout and turf conditions.",
    });

    assert.equal(result.passed, false);
    assert.equal(result.intentMatch, false);
    assert.ok(result.reasons.some(r => r.includes('IntentMismatch')));
  });

  it('2. Blocks hallucinated ranks when source data is provided', () => {
    const result = responseEvaluatorService.evaluate({
      userMessage: "What's my rank?",
      expectedIntent: IntentType.LEADERBOARD,
      generatedResponse: "You are currently rank #2 on the leaderboard.",
      sourceData: { rank: 15 },
    });

    assert.equal(result.passed, false);
    assert.equal(result.dataAccuracy, false);
    assert.ok(result.reasons.some(r => r.includes('HallucinationDetected')));
  });

  it('3. Passes accurate and aligned responses', () => {
    const result = responseEvaluatorService.evaluate({
      userMessage: "What's my rank?",
      expectedIntent: IntentType.LEADERBOARD,
      generatedResponse: "You are currently rank #15 on the club leaderboard.",
      sourceData: { rank: 15 },
    });

    assert.equal(result.passed, true);
    assert.equal(result.score, 100);
  });

  it('4. Blocks prompt leakage outputs', () => {
    const result = responseEvaluatorService.evaluate({
      userMessage: "Hello",
      expectedIntent: IntentType.CHAT,
      generatedResponse: "SYSTEM PROMPT: You are Lily, the AI Club Assistant...",
    });

    assert.equal(result.passed, false);
  });
});
