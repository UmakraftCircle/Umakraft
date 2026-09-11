import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { routeMessage, detectActiveTopic } from '../../apps/discord/src/domain-router.js';

describe('Phase E2 — Adaptive Response Strategy Engine Tests', () => {
  it('1. Routes "Tell me about Smart Falcon" to CHARACTER_CHAT with INFORMATIONAL strategy', async () => {
    const decision = await routeMessage({
      userId: 'test-user-1',
      message: 'Tell me about Smart Falcon',
    });
    assert.equal(decision.domain, 'CHARACTER_CHAT');
    assert.equal(decision.strategy, 'INFORMATIONAL');
    assert.equal(decision.handler, 'LilyChatService');
  });

  it('2. Routes "I love Smart Falcon" to CHARACTER_CHAT with CONVERSATIONAL strategy', async () => {
    const decision = await routeMessage({
      userId: 'test-user-1',
      message: 'I love Smart Falcon',
    });
    assert.equal(decision.domain, 'CHARACTER_CHAT');
    assert.equal(decision.strategy, 'CONVERSATIONAL');
    assert.equal(decision.handler, 'LilyChatService');
  });

  it('3. Routes "Should I train Smart Falcon?" to CHARACTER_CHAT with ADVISORY strategy', async () => {
    const decision = await routeMessage({
      userId: 'test-user-1',
      message: 'Should I train Smart Falcon?',
    });
    assert.equal(decision.domain, 'CHARACTER_CHAT');
    assert.equal(decision.strategy, 'ADVISORY');
    assert.equal(decision.handler, 'LilyChatService');
  });

  it('4. Routes "Smart Falcon or Oguri Cap?" to CHARACTER_CHAT with COMPARISON strategy', async () => {
    const decision = await routeMessage({
      userId: 'test-user-1',
      message: 'Smart Falcon or Oguri Cap?',
    });
    assert.equal(decision.domain, 'CHARACTER_CHAT');
    assert.equal(decision.strategy, 'COMPARISON');
    assert.equal(decision.handler, 'LilyChatService');
  });

  it('5. Context-aware pronoun routing ("What about her?") with active topic resolves correctly', async () => {
    const history = [
      { role: 'user', content: 'Tell me about Smart Falcon.' },
      { role: 'assistant', content: 'Smart Falcon is an iconic dirt runner...' },
    ];
    const activeTopic = detectActiveTopic(history);
    assert.equal(activeTopic, 'Smart Falcon');

    const decision = await routeMessage({
      userId: 'test-user-1',
      message: 'What makes her unique?',
      recentHistory: history,
      activeTopic,
    });
    assert.equal(decision.domain, 'CHARACTER_CHAT');
    assert.equal(decision.handler, 'LilyChatService');
  });
});
