/**
 * ActionController regression tests.
 *
 * Guards against the concurrency-slot resource leak: before the fix,
 * `execute()` acquired a concurrency slot via `RateLimitedExecutor.acquireConcurrency()`
 * but never released it, so after `maxConcurrentTasks` executions the controller
 * permanently rejected every subsequent action with "Max concurrent tasks reached".
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('ActionController concurrency release', () => {
  let ActionController: any;
  let RateLimitedExecutor: any;
  let DEFAULT_RATE_LIMITS: any;

  before(async () => {
    const mod = await import('@ai-agent-platform/integrations');
    ActionController = mod.ActionController;
    RateLimitedExecutor = mod.RateLimitedExecutor;
    DEFAULT_RATE_LIMITS = mod.DEFAULT_RATE_LIMITS;
  });

  function makeController(maxConcurrent = 1) {
    const config = { ...DEFAULT_RATE_LIMITS, maxConcurrentTasks: maxConcurrent };
    const limiter = new RateLimitedExecutor(config);
    const controller = new ActionController(limiter, config);
    return controller;
  }

  it('releases the concurrency slot after a successful action', async () => {
    const controller = makeController(1);

    for (let i = 0; i < 5; i++) {
      const out = await controller.execute({
        slug: 'get_trainer_stats',
        userId: 'u1',
        action: async () => ({ ok: true }),
      });
      assert.equal(out.ok, true, `run ${i} should succeed`);
    }

    assert.equal(controller.concurrency, 0, 'concurrency slot must be released after each action');
  });

  it('releases the concurrency slot even when the action fails permanently', async () => {
    const controller = makeController(1);

    for (let i = 0; i < 5; i++) {
      const out = await controller.execute({
        slug: 'get_trainer_stats',
        userId: 'u1',
        action: async () => { throw new Error('permanent failure (not retryable)'); },
        maxRetries: 0,
      });
      assert.equal(out.ok, false);
    }

    assert.equal(controller.concurrency, 0, 'concurrency slot must be released even after failures');
  });
});
