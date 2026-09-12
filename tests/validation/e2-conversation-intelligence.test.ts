import { test } from 'node:test';
import assert from 'node:assert';
import { ConversationService, ClarificationEngine } from '../../packages/lily-ai/src/conversation/index.js';

test('E2 — Conversation Intelligence', async (t) => {
  const conversationService = new ConversationService();
  const clarificationEngine = new ClarificationEngine();

  await t.test('E2.1 Ambiguous Request Detection', () => {
    assert.strictEqual(clarificationEngine.needsClarification('Hi'), true);
  });

  await t.test('E2.2 Frustration Detection', () => {
    const response = conversationService.handleInput('I keep failing this race');
    assert.ok(response.includes('frustrated'));
  });
});
