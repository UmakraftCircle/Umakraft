/**
 * TaskManager Unit Tests
 * 
 * Tests the DAG scheduler: parallel execution, dependency ordering,
 * deadlock detection, retry logic, and failure propagation.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// We test against a lightweight mock registry so we control tool behavior.
class MockToolRegistry {
  private tools = new Map<string, { slug: string; handler: (args: any) => Promise<any> }>();

  register(slug: string, handler: (args: any) => Promise<any>) {
    this.tools.set(slug, { slug, handler });
  }

  getDeclarativeSchemas() {
    return Array.from(this.tools.values()).map(({ handler, ...rest }) => rest);
  }

  async execute(slug: string, args: Record<string, any>) {
    const tool = this.tools.get(slug);
    if (!tool) return { success: false, error: `Unknown tool: ${slug}` };
    try {
      const data = await tool.handler(args);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

// Dynamically import the TaskManager (ESM)
async function createTaskManager() {
  const { TaskManager } = await import('@ai-agent-platform/core');
  const registry = new MockToolRegistry();
  return { TaskManager, registry };
}

// ── Helper: build a simple plan ──
function makePlan(id: string, intent: string, tasks: Array<{
  id: string; name: string; toolSlug: string; dependencies?: string[]; maxRetries?: number;
}>) {
  const tasksMap = new Map();
  for (const t of tasks) {
    tasksMap.set(t.id, {
      id: t.id,
      name: t.name,
      toolSlug: t.toolSlug,
      arguments: {},
      dependencies: t.dependencies || [],
      status: 'pending',
      retryCount: 0,
      maxRetries: t.maxRetries ?? 3,
    });
  }
  return {
    id,
    intent,
    tasks: tasksMap,
    metadata: {
      modelUsed: 'test-model',
      createdAt: new Date().toISOString(),
      estimatedSteps: tasks.length,
    },
  };
}

// ── Tests ──

describe('TaskManager', () => {
  describe('executePlan — basic DAG scheduling', () => {
    it('should execute tasks with no dependencies in parallel', async () => {
      const { TaskManager, registry } = await createTaskManager();
      const completed: string[] = [];

      registry.register('tool-a', async () => { completed.push('a'); return 'result-a'; });
      registry.register('tool-b', async () => { completed.push('b'); return 'result-b'; });

      const plan = makePlan('p1', 'parallel test', [
        { id: 'a', name: 'Task A', toolSlug: 'tool-a' },
        { id: 'b', name: 'Task B', toolSlug: 'tool-b' },
      ]);

      const mgr = new TaskManager(registry as any);
      await mgr.executePlan(plan);

      assert.equal(plan.tasks.get('a').status, 'completed');
      assert.equal(plan.tasks.get('b').status, 'completed');
      // Both should have completed (order not guaranteed for parallel)
      assert.ok(completed.includes('a'));
      assert.ok(completed.includes('b'));
    });

    it('should execute tasks in dependency order (chain)', async () => {
      const { TaskManager, registry } = await createTaskManager();
      const order: string[] = [];

      registry.register('first', async () => { order.push('first'); return 1; });
      registry.register('second', async () => { order.push('second'); return 2; });
      registry.register('third', async () => { order.push('third'); return 3; });

      const plan = makePlan('p2', 'chain test', [
        { id: 'first', name: 'First', toolSlug: 'first' },
        { id: 'second', name: 'Second', toolSlug: 'second', dependencies: ['first'] },
        { id: 'third', name: 'Third', toolSlug: 'third', dependencies: ['second'] },
      ]);

      const mgr = new TaskManager(registry as any);
      await mgr.executePlan(plan);

      assert.deepEqual(order, ['first', 'second', 'third']);
      assert.equal(plan.tasks.get('first').status, 'completed');
      assert.equal(plan.tasks.get('second').status, 'completed');
      assert.equal(plan.tasks.get('third').status, 'completed');
    });

    it('should execute independent branches of a DAG in parallel', async () => {
      const { TaskManager, registry } = await createTaskManager();
      const startTimes: Record<string, number> = {};

      registry.register('root', async () => { startTimes['root'] = Date.now(); return 'root'; });
      registry.register('branch-a', async () => {
        await new Promise(r => setTimeout(r, 50));
        startTimes['branch-a'] = Date.now();
        return 'a';
      });
      registry.register('branch-b', async () => {
        await new Promise(r => setTimeout(r, 50));
        startTimes['branch-b'] = Date.now();
        return 'b';
      });

      const plan = makePlan('p3', 'dag test', [
        { id: 'root', name: 'Root', toolSlug: 'root' },
        { id: 'branch-a', name: 'Branch A', toolSlug: 'branch-a', dependencies: ['root'] },
        { id: 'branch-b', name: 'Branch B', toolSlug: 'branch-b', dependencies: ['root'] },
      ]);

      const mgr = new TaskManager(registry as any);
      await mgr.executePlan(plan);

      // Both branches started after root
      assert.ok(startTimes['branch-a'] > startTimes['root']);
      assert.ok(startTimes['branch-b'] > startTimes['root']);
      assert.equal(plan.tasks.get('branch-a').status, 'completed');
      assert.equal(plan.tasks.get('branch-b').status, 'completed');
    });
  });

  describe('deadlock detection', () => {
    it('should detect circular dependencies and mark plan as failed', async () => {
      const { TaskManager, registry } = await createTaskManager();

      registry.register('tool-x', async () => 'x');
      registry.register('tool-y', async () => 'y');

      // a depends on b, b depends on a — unresolvable
      const plan = makePlan('p4', 'deadlock test', [
        { id: 'a', name: 'Task A', toolSlug: 'tool-x', dependencies: ['b'] },
        { id: 'b', name: 'Task B', toolSlug: 'tool-y', dependencies: ['a'] },
      ]);

      const mgr = new TaskManager(registry as any);
      await mgr.executePlan(plan);

      // Both tasks should still be pending — deadlock detected
      assert.equal(plan.tasks.get('a').status, 'pending');
      assert.equal(plan.tasks.get('b').status, 'pending');
    });
  });

  describe('retry logic', () => {
    it('should retry failed tasks up to maxRetries', async () => {
      const { TaskManager, registry } = await createTaskManager();
      let attempts = 0;

      registry.register('flaky', async () => {
        attempts++;
        if (attempts < 3) throw new Error('Transient failure');
        return 'success-on-third-try';
      });

      const plan = makePlan('p5', 'retry test', [
        { id: 'f1', name: 'Flaky', toolSlug: 'flaky', maxRetries: 4 },
      ]);

      const mgr = new TaskManager(registry as any);
      await mgr.executePlan(plan);

      assert.equal(attempts, 3);
      assert.equal(plan.tasks.get('f1').status, 'completed');
      assert.equal(plan.tasks.get('f1').retryCount, 2);
    });

    it('should mark permanently failed if retries exhausted', async () => {
      const { TaskManager, registry } = await createTaskManager();

      registry.register('always-fail', async () => { throw new Error('Permanent failure'); });

      const plan = makePlan('p6', 'exhaust test', [
        { id: 'f2', name: 'Always Fail', toolSlug: 'always-fail', maxRetries: 1 },
      ]);

      const mgr = new TaskManager(registry as any);
      await mgr.executePlan(plan);

      assert.equal(plan.tasks.get('f2').status, 'failed');
      assert.equal(plan.tasks.get('f2').retryCount, 2); // tried once, then retry, then gave up
    });

    it('should back off linearly between retries', async () => {
      const { TaskManager, registry } = await createTaskManager();
      const timestamps: number[] = [];

      registry.register('timed-fail', async () => {
        timestamps.push(Date.now());
        throw new Error('fail');
      });

      const plan = makePlan('p7', 'backoff test', [
        { id: 'tf', name: 'Timed Fail', toolSlug: 'timed-fail', maxRetries: 2 },
      ]);

      const mgr = new TaskManager(registry as any);
      await mgr.executePlan(plan);

      // 3 attempts: initial + 2 retries
      assert.equal(timestamps.length, 3);
      // Backoff: attempt 1 → 200ms → attempt 2 → 400ms → attempt 3
      assert.ok(timestamps[1] - timestamps[0] >= 180, 'First retry backoff too short');
      assert.ok(timestamps[2] - timestamps[1] >= 380, 'Second retry backoff too short');
    });
  });

  describe('failure propagation', () => {
    it('should not execute dependents of a failed task', async () => {
      const { TaskManager, registry } = await createTaskManager();
      let dependentRan = false;

      registry.register('fail-here', async () => { throw new Error('Boom'); });
      registry.register('dont-run', async () => { dependentRan = true; return 'should not happen'; });

      const plan = makePlan('p8', 'propagation test', [
        { id: 'fail', name: 'Fail', toolSlug: 'fail-here', maxRetries: 0 },
        { id: 'dep', name: 'Dependent', toolSlug: 'dont-run', dependencies: ['fail'] },
      ]);

      const mgr = new TaskManager(registry as any);
      await mgr.executePlan(plan);

      assert.equal(plan.tasks.get('fail').status, 'failed');
      assert.equal(dependentRan, false);
      // Dependent should still be pending since hasFailed stops the loop
      assert.ok(plan.tasks.get('dep').status === 'pending');
    });
  });
});
