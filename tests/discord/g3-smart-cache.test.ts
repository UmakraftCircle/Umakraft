import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { smartCacheService } from '../../apps/discord/src/smart-cache.js';
import { IntentType } from '../../apps/discord/src/intent-router.js';

describe('G3 — Smart Cache System Tests', () => {
  beforeEach(() => {
    smartCacheService.clear();
  });

  it('1. Never caches CHAT conversation intents', () => {
    smartCacheService.put({
      intent: IntentType.CHAT,
      query: "How are you?",
      data: "I am doing great!",
    });

    const cached = smartCacheService.get({
      intent: IntentType.CHAT,
      query: "How are you?",
      similarity: 0.95,
    });

    assert.equal(cached, null);
    const metrics = smartCacheService.getMetrics();
    assert.equal(metrics.cacheMiss, 1);
  });

  it('2. Caches HANDBOOK static knowledge and hits on exact query', () => {
    smartCacheService.put({
      intent: IntentType.HANDBOOK,
      query: "monthly requirement",
      data: "150 million fans",
    });

    const cached = smartCacheService.get({
      intent: IntentType.HANDBOOK,
      query: "monthly requirement",
      similarity: 0.90,
    });

    assert.equal(cached, "150 million fans");
    const metrics = smartCacheService.getMetrics();
    assert.equal(metrics.cacheHit, 1);
  });

  it('3. Enforces trainer-specific scoping for FAN_SYSTEM caches', () => {
    smartCacheService.put({
      intent: IntentType.FAN_SYSTEM,
      query: "my fan gain",
      data: "2,000,000",
      trainerId: "trainer-A",
    });

    // Trainer B requesting their fan gain should NOT hit Trainer A's cache
    const cachedForB = smartCacheService.get({
      intent: IntentType.FAN_SYSTEM,
      query: "my fan gain",
      trainerId: "trainer-B",
      similarity: 0.90,
    });

    assert.equal(cachedForB, null);

    // Trainer A requesting should hit
    const cachedForA = smartCacheService.get({
      intent: IntentType.FAN_SYSTEM,
      query: "my fan gain",
      trainerId: "trainer-A",
      similarity: 0.90,
    });

    assert.equal(cachedForA, "2,000,000");
  });

  it('4. Rejects low similarity queries (< 0.85)', () => {
    smartCacheService.put({
      intent: IntentType.HANDBOOK,
      query: "monthly requirement",
      data: "150 million fans",
    });

    const cached = smartCacheService.get({
      intent: IntentType.HANDBOOK,
      query: "monthly requirement",
      similarity: 0.70, // below 0.85
    });

    assert.equal(cached, null);
    const metrics = smartCacheService.getMetrics();
    assert.equal(metrics.similarityRejected, 1);
  });
});
