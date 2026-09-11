import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { intentRouterService, IntentType } from '../../apps/discord/src/intent-router.js';
import { responseValidationService } from '../../apps/discord/src/response-validation.js';

describe('G1 — Intent Router & Response Validation Service Tests', () => {
  it('1. Routes leaderboard queries correctly', () => {
    const result = intentRouterService.route("What's the fan leaderboard rank?");
    assert.equal(result.intent, IntentType.LEADERBOARD);
    assert.equal(result.source, 'RULE_DETECTION');
  });

  it('2. Routes fan system queries correctly', () => {
    const result = intentRouterService.route("What's my fan gain today?");
    assert.equal(result.intent, IntentType.FAN_SYSTEM);
  });

  it('3. Routes link request queries correctly', () => {
    const result = intentRouterService.route("How do I link my account and trainer id?");
    assert.equal(result.intent, IntentType.LINK_REQUEST);
  });

  it('4. Routes handbook queries correctly', () => {
    const result = intentRouterService.route("What are the club handbook requirements?");
    assert.equal(result.intent, IntentType.HANDBOOK);
  });

  it('5. Routes character chat queries (Yamanin Zephyr bust size) to CHAT, avoiding repository/handbook reader bugs', () => {
    const result = intentRouterService.route("What is Yamanin Zephyr's bust size?");
    assert.equal(result.intent, IntentType.CHAT);
  });

  it('6. ResponseValidationService detects and rejects cross-domain mismatches', () => {
    const validation = responseValidationService.validateResponse(
      "What is Yamanin Zephyr's bust size?",
      IntentType.CHAT,
      "Queen Elizabeth Cup track layout and turf conditions."
    );

    assert.equal(validation.isValid, false);
    assert.ok(validation.similarityScore < 0.1);
    assert.ok(validation.reason?.includes('Domain mismatch'));
  });
});
