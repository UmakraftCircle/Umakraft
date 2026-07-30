/**
 * LearningEngine Unit Tests
 * 
 * Tests failure observation recording, pattern matching, adaptation rule derivation,
 * and planner context generation.
 */
import { describe, it, beforeEach, before } from 'node:test';
import assert from 'node:assert';

describe('LearningEngine', () => {
  let LearningEngine: any;

  before(async () => {
    const mod = await import('@ai-agent-platform/core');
    LearningEngine = mod.LearningEngine;
  });

  describe('initialization', () => {
    it('should create an engine without a memory store', () => {
      const engine = new LearningEngine();
      assert.ok(engine);
      assert.equal(engine.getStats().totalFailures, 0);
    });

    it('should initialize (no-op) without MemoryStore', async () => {
      const engine = new LearningEngine();
      await engine.init(); // should not throw
      assert.equal(engine.getStats().totalFailures, 0);
    });
  });

  describe('recordFailure', () => {
    let engine: any;

    beforeEach(async () => {
      engine = new LearningEngine();
      await engine.init();
    });

    it('should record a failure observation', async () => {
      await engine.recordFailure({
        taskId: 'task-1',
        taskName: 'Failing Task',
        toolSlug: 'file-write',
        errorMessage: 'EACCES: permission denied, cannot write file',
        timestamp: new Date().toISOString(),
      });

      const stats = engine.getStats();
      assert.equal(stats.totalFailures, 1);
    });

    it('should derive adaptation rules from matching patterns', async () => {
      await engine.recordFailure({
        taskId: 'task-2',
        taskName: 'File Write',
        toolSlug: 'file-write',
        errorMessage: 'EACCES: permission denied',
        timestamp: new Date().toISOString(),
      });

      const rules = engine.getAdaptationRules();
      assert.ok(rules.length >= 1, 'Should derive at least one rule');
      const permissionRule = rules.find((r: any) => r.suggestion.includes('permissions') || r.suggestion.includes('file paths'));
      assert.ok(permissionRule, 'Should find a permission-related rule');
    });

    it('should increment occurrences for repeated patterns', async () => {
      const ts = new Date().toISOString();
      await engine.recordFailure({
        taskId: 't-a', taskName: 'A', toolSlug: 'web',
        errorMessage: 'Timeout connecting to server',
        timestamp: ts,
      });
      await engine.recordFailure({
        taskId: 't-b', taskName: 'B', toolSlug: 'web',
        errorMessage: 'Connection timed out after 30s',
        timestamp: ts,
      });

      const rules = engine.getAdaptationRules();
      const timeoutRule = rules.find((r: any) =>
        r.suggestion.toLowerCase().includes('timeout') || r.pattern.includes('timeout')
      );
      assert.ok(timeoutRule);
      assert.ok(timeoutRule.occurrences >= 1);
    });

    it('should handle errors without pattern matches gracefully', async () => {
      await engine.recordFailure({
        taskId: 'task-x',
        taskName: 'X',
        toolSlug: 'unknown',
        errorMessage: 'Some completely novel error message 12345',
        timestamp: new Date().toISOString(),
      });

      // Should not throw, just record observation without new rules
      const stats = engine.getStats();
      assert.equal(stats.totalFailures, 1);
    });
  });

  describe('generatePlannerContext', () => {
    it('should return empty string when no rules exist', () => {
      const engine = new LearningEngine();
      const context = engine.generatePlannerContext();
      assert.equal(context, '');
    });

    it('should return a formatted context block with rules', async () => {
      const engine = new LearningEngine();
      await engine.init();
      await engine.recordFailure({
        taskId: 't-1', taskName: 'T1', toolSlug: 'fs',
        errorMessage: 'EACCES: permission denied',
        timestamp: new Date().toISOString(),
      });

      const context = engine.generatePlannerContext();
      assert.ok(context.length > 0);
      assert.ok(context.includes('Failure Adaptations'));
      assert.ok(context.includes('permission') || context.includes('file paths'));
    });
  });

  describe('applyFixes', () => {
    it('should fix non-absolute paths for EACCES pattern', async () => {
      const engine = new LearningEngine();
      await engine.init();
      await engine.recordFailure({
        taskId: 't-fix', taskName: 'Fix', toolSlug: 'fs',
        errorMessage: 'EACCES: permission denied for relative path',
        timestamp: new Date().toISOString(),
      });

      const fixed = engine.applyFixes('fs', { path: 'relative/path' });
      assert.equal(fixed.path, '/relative/path');
    });

    it('should leave already-absolute paths alone', async () => {
      const engine = new LearningEngine();
      await engine.init();
      await engine.recordFailure({
        taskId: 't-fix2', taskName: 'Fix2', toolSlug: 'fs',
        errorMessage: 'EACCES: permission denied',
        timestamp: new Date().toISOString(),
      });

      const fixed = engine.applyFixes('fs', { path: '/already/absolute' });
      assert.equal(fixed.path, '/already/absolute');
    });

    it('should return unchanged args when no rules apply', () => {
      const engine = new LearningEngine();
      const fixed = engine.applyFixes('web', { url: 'https://example.com' });
      assert.deepEqual(fixed, { url: 'https://example.com' });
    });
  });

  describe('getStats', () => {
    it('should return zero failures for fresh engine', () => {
      const engine = new LearningEngine();
      const stats = engine.getStats();
      assert.equal(stats.totalFailures, 0);
      assert.deepEqual(stats.topRules, []);
    });

    it('should return accumulated stats after failures', async () => {
      const engine = new LearningEngine();
      await engine.init();
      for (let i = 0; i < 5; i++) {
        await engine.recordFailure({
          taskId: `task-${i}`,
          taskName: `Task ${i}`,
          toolSlug: 'web',
          errorMessage: 'Timeout',
          timestamp: new Date().toISOString(),
        });
      }

      const stats = engine.getStats();
      assert.equal(stats.totalFailures, 5);
    });
  });
});
