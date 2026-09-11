import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { contextBuilderService } from '../../apps/discord/src/context-builder.js';
import { IntentType } from '../../apps/discord/src/intent-router.js';

describe('G2 — Context Builder & Validator Tests', () => {
  it('1. CHAT context strictly isolates personality, history, and profile without handbook or leaderboard leakage', () => {
    const context = contextBuilderService.buildContext({
      intent: IntentType.CHAT,
      userMessage: "What is Yamanin Zephyr's bust size?",
      trainerId: 'trainer-1',
      recentMessages: ['msg1', 'msg2'],
      trainerProfile: { favoriteUmamusume: 'Yamanin Zephyr' },
      handbookSnippets: ['Club rule 1: be active'],
      leaderboardData: { rank: 5 },
    });

    assert.equal(context.intent, IntentType.CHAT);
    assert.equal(context.handbookEntries, undefined);
    assert.equal(context.leaderboardSnapshot, undefined);

    const validation = contextBuilderService.validateContext(context);
    assert.equal(validation.isValid, true);
  });

  it('2. HANDBOOK context isolates handbook snippets and question without leaderboard leakage', () => {
    const context = contextBuilderService.buildContext({
      intent: IntentType.HANDBOOK,
      userMessage: 'What are the club requirements?',
      trainerId: 'trainer-2',
      handbookSnippets: ['Requirement: 150M fans monthly'],
      leaderboardData: { rank: 1 },
    });

    assert.equal(context.intent, IntentType.HANDBOOK);
    assert.equal(context.leaderboardSnapshot, undefined);

    const validation = contextBuilderService.validateContext(context);
    assert.equal(validation.isValid, true);
  });

  it('3. FAN_SYSTEM context isolates fan statistics', () => {
    const context = contextBuilderService.buildContext({
      intent: IntentType.FAN_SYSTEM,
      userMessage: 'How many fans do I need today?',
      trainerId: 'trainer-3',
      fanStats: { currentFans: 120_000_000, targetFans: 150_000_000 },
    });

    assert.equal(context.intent, IntentType.FAN_SYSTEM);
    assert.deepEqual(context.fanData, { currentFans: 120_000_000, targetFans: 150_000_000, dailyGain: 0, deficit: 0 });
  });

  it('4. ContextValidator catches leakage in CHAT context', () => {
    const leakedContext = {
      intent: IntentType.CHAT,
      systemPrompt: 'Lily',
      handbookEntries: ['leaked rule'],
      tokenEstimate: 500,
    };

    const validation = contextBuilderService.validateContext(leakedContext);
    assert.equal(validation.isValid, false);
    assert.ok(validation.violation?.includes('Handbook entries leaked'));
  });
});
