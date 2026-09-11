import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiGatewayService, TaskType, usageTracker, latencyTracker, KeyPoolManager } from '../../apps/discord/src/ai/ai-gateway.js';

describe('H4 — Model Strategy & AI Gateway Tests', () => {
  it('1. Routes intent classification tasks to fast models and chat to smart models', () => {
    const res1 = aiGatewayService.call(TaskType.INTENT_CLASSIFICATION, 'What is my rank?');
    assert.ok(res1.modelUsed.includes('8b') || res1.modelUsed.includes('instant'));

    const res2 = aiGatewayService.call(TaskType.CHAT, 'Explain pacing strategy for long distance.');
    assert.ok(res2.modelUsed.includes('70b') || res2.modelUsed.includes('versatile'));
  });

  it('2. Tracks usage and latency correctly', () => {
    aiGatewayService.call(TaskType.TOOL_PLANNING, 'Show fans');
    const usage = usageTracker.getUsageReport();
    assert.ok(usage[TaskType.TOOL_PLANNING]);
    assert.ok(usage[TaskType.TOOL_PLANNING].calls > 0);

    const avg = latencyTracker.getAverageLatency('llama-3.1-8b-instant');
    assert.ok(avg >= 0);
  });

  it('3. Rotates API keys via KeyPoolManager', () => {
    const k1 = KeyPoolManager.getInstance().getNextGroqKey();
    const k2 = KeyPoolManager.getInstance().getNextGroqKey();
    assert.ok(k1);
    assert.ok(k2);
  });
});
