import test from 'node:test';
import assert from 'node:assert/strict';
import { askQuestionStore, askResponseCache } from '../../packages/integrations/src/index.js';

test('AskQuestionStore: create, correctAnswer, and listRecent', async () => {
  askQuestionStore.clearMemory();
  askResponseCache.clearMemory();

  // 1. Create a question
  const q = await askQuestionStore.create({
    question: 'How to build Oguri Cap for Arima Kinen?',
    userId: 'user_123',
    channelId: 'chan_456',
  });

  assert.ok(q.id.startsWith('qid_'));
  assert.equal(q.status, 'pending');
  assert.equal(q.answer, null);
  assert.equal(q.usageCount, 0);

  // 2. Admin applies a correction (force removes old/pending answer and replaces with verified answer)
  const verifiedAnswer = 'Focus on Speed 1200, Stamina 900+ with gold recovery skills (like Gourmand), and Power 900.';
  const { previousAnswer, record } = await askQuestionStore.correctAnswer(q.id, verifiedAnswer, true);

  assert.equal(previousAnswer, null);
  assert.ok(record);
  assert.equal(record.answer, verifiedAnswer);
  assert.equal(record.status, 'completed');
  assert.equal(record.usageCount, 0);

  // 3. Update response cache and verify
  await askResponseCache.set('how to build oguri cap for arima kinen?', verifiedAnswer);
  const cached = await askResponseCache.get('how to build oguri cap for arima kinen?');
  assert.equal(cached, verifiedAnswer);

  // 4. Overwrite correction again
  const refinedAnswer = 'Updated: Speed 1200, Stamina 950+ with Maestro & Gourmand.';
  const secondCorrection = await askQuestionStore.correctAnswer(q.id, refinedAnswer, true);
  assert.equal(secondCorrection.previousAnswer, verifiedAnswer);
  assert.equal(secondCorrection.record?.answer, refinedAnswer);

  // 5. Autocomplete / listRecent
  const recent = await askQuestionStore.listRecent(10, 'oguri');
  assert.ok(recent.length >= 1);
  assert.equal(recent[0].id, q.id);
});
