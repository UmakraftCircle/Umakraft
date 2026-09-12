import { test } from 'node:test';
import assert from 'node:assert';
import { FanMonitor, NotificationEngine } from '../../packages/lily-ai/src/intelligence/proactive/index.js';

test('D6 — Proactive Intelligence', async (t) => {
  const engine = new NotificationEngine();
  const fanMonitor = new FanMonitor();

  await t.test('D6.1 Fan Deficit Alert', () => {
    const notification = fanMonitor.checkFanStatus(40, 100);
    assert.ok(notification);
    assert.strictEqual(notification?.priority, 'HIGH');
    assert.ok(engine.shouldNotify(notification!.score));
  });

  await t.test('D6.2 Spam Prevention', () => {
    const score = { usefulness: 0.1, urgency: 0.1, confidence: 0.1 };
    assert.strictEqual(engine.shouldNotify(score), false);
  });
});
