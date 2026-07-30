/**
 * Validator Unit Tests
 * 
 * Tests Zod schemas for all core entities and Kahn's algorithm for DAG cycle detection.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('Validator', () => {
  let validateExecutionPlan: any;
  let detectCycles: any;
  let AgentTaskSchema: any;
  let ExecutionPlanSchema: any;

  before(async () => {
    const mod = await import('@ai-agent-platform/core');
    validateExecutionPlan = mod.validateExecutionPlan;
    detectCycles = mod.detectCycles;
    AgentTaskSchema = mod.AgentTaskSchema;
    ExecutionPlanSchema = mod.ExecutionPlanSchema;
  });

  describe('AgentTaskSchema', () => {
    it('should accept a valid task', () => {
      const result = AgentTaskSchema.safeParse({
        id: 'task-1',
        name: 'Fetch Data',
        toolSlug: 'fetch-tool',
        arguments: { url: 'https://example.com' },
        dependencies: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      });
      assert.ok(result.success);
    });

    it('should reject task with empty id', () => {
      const result = AgentTaskSchema.safeParse({
        id: '',
        name: 'Bad Task',
        toolSlug: 'tool',
        arguments: {},
        dependencies: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      });
      assert.equal(result.success, false);
    });

    it('should reject invalid status', () => {
      const result = AgentTaskSchema.safeParse({
        id: 't1',
        name: 'Task',
        toolSlug: 'tool',
        arguments: {},
        dependencies: [],
        status: 'unknown-status',
        retryCount: 0,
        maxRetries: 3,
      });
      assert.equal(result.success, false);
    });

    it('should reject negative retryCount', () => {
      const result = AgentTaskSchema.safeParse({
        id: 't1',
        name: 'Task',
        toolSlug: 'tool',
        arguments: {},
        dependencies: [],
        status: 'pending',
        retryCount: -1,
        maxRetries: 3,
      });
      assert.equal(result.success, false);
    });

    it('should accept task with result and error fields', () => {
      const result = AgentTaskSchema.safeParse({
        id: 't1',
        name: 'Task',
        toolSlug: 'tool',
        arguments: {},
        dependencies: [],
        status: 'completed',
        result: { data: 'success' },
        error: undefined,
        retryCount: 0,
        maxRetries: 3,
      });
      assert.ok(result.success);
    });
  });

  describe('ExecutionPlanSchema', () => {
    it('should accept a valid plan (array form for JSON transport)', () => {
      const tasks = [{
        id: 't1',
        name: 'Task 1',
        toolSlug: 'tool-a',
        arguments: {},
        dependencies: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      }];
      const result = ExecutionPlanSchema.safeParse({
        id: 'plan-1',
        intent: 'Test intent',
        tasks,
        metadata: {
          modelUsed: 'test-model',
          createdAt: new Date().toISOString(),
          estimatedSteps: 1,
        },
      });
      assert.ok(result.success);
    });

    it('should reject plan with empty tasks array', () => {
      const result = ExecutionPlanSchema.safeParse({
        id: 'plan-1',
        intent: 'Test',
        tasks: [],
        metadata: {
          modelUsed: 'test-model',
          createdAt: new Date().toISOString(),
          estimatedSteps: 0,
        },
      });
      assert.equal(result.success, false);
    });

    it('should reject plan with missing intent', () => {
      const result = ExecutionPlanSchema.safeParse({
        id: 'plan-1',
        intent: '',
        tasks: [{ id: 't1', name: 'T', toolSlug: 'x', arguments: {}, dependencies: [], status: 'pending', retryCount: 0, maxRetries: 3 }],
        metadata: { modelUsed: 'm', createdAt: new Date().toISOString(), estimatedSteps: 1 },
      });
      assert.equal(result.success, false);
    });
  });

  describe('validateExecutionPlan', () => {
    it('should validate a correct plan payload', () => {
      const result = validateExecutionPlan({
        id: 'plan-ok',
        intent: 'Do something',
        tasks: [{
          id: 't1', name: 'T1', toolSlug: 'web-fetch',
          arguments: {}, dependencies: [], status: 'pending', retryCount: 0, maxRetries: 3,
        }],
        metadata: {
          modelUsed: 'claude-3-5-sonnet',
          createdAt: new Date().toISOString(),
          estimatedSteps: 1,
        },
      });
      assert.ok(result.valid, `Expected valid, got errors: ${result.errors.join(', ')}`);
    });

    it('should reject null/undefined', () => {
      const r1 = validateExecutionPlan(null);
      assert.equal(r1.valid, false);

      const r2 = validateExecutionPlan(undefined);
      assert.equal(r2.valid, false);
    });

    it('should reject malformed JSON', () => {
      const result = validateExecutionPlan({ id: 'x' }); // missing most fields
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
    });
  });

  describe('detectCycles — Kahn\'s algorithm', () => {
    it('should return null for a valid DAG (no cycles)', () => {
      const tasks = [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['a'] },
        { id: 'd', dependencies: ['b', 'c'] },
      ];
      assert.equal(detectCycles(tasks), null);
    });

    it('should return cycle nodes for a simple cycle (a → b → a)', () => {
      const tasks = [
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: ['a'] },
      ];
      const result = detectCycles(tasks);
      assert.notEqual(result, null);
      assert.equal(result!.length, 2);
    });

    it('should return cycle node for a self-referencing task', () => {
      const tasks = [
        { id: 'a', dependencies: ['a'] },
      ];
      const result = detectCycles(tasks);
      assert.notEqual(result, null);
      assert.ok(result!.includes('a'));
    });

    it('should detect 3-node cycle (a → b → c → a)', () => {
      const tasks = [
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: ['c'] },
        { id: 'c', dependencies: ['a'] },
      ];
      const result = detectCycles(tasks);
      assert.notEqual(result, null);
      assert.equal(result!.length, 3);
    });

    it('should handle empty task array', () => {
      assert.equal(detectCycles([]), null);
    });

    it('should handle tasks with no dependencies', () => {
      const tasks = [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: [] },
        { id: 'c', dependencies: [] },
      ];
      assert.equal(detectCycles(tasks), null);
    });

    it('should accept a diamond DAG (a → b,c → d)', () => {
      const tasks = [
        { id: 'a', dependencies: [] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['a'] },
        { id: 'd', dependencies: ['b', 'c'] },
      ];
      assert.equal(detectCycles(tasks), null);
    });
  });
});
