import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DagScheduler } from '../../packages/core/src/scheduler.js';
import { DefaultTaskExecutor } from '../../packages/core/src/task-executor.js';

class MockToolRegistry {
  private tools = new Map<string, (args: any) => Promise<any>>();

  register(slug: string, handler: (args: any) => Promise<any>) {
    this.tools.set(slug, handler);
  }

  async execute(slug: string, args: Record<string, any>) {
    const tool = this.tools.get(slug);
    if (!tool) return { success: false, error: `Unknown tool: ${slug}` };
    try {
      const data = await tool(args);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

function makeTestPlan(tasks: Array<{ id: string; tool: string; deps?: string[] }>) {
  const map = new Map();
  for (const t of tasks) {
    map.set(t.id, {
      id: t.id,
      name: t.id,
      toolSlug: t.tool,
      arguments: {},
      dependencies: t.deps || [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });
  }
  return {
    id: 'test-plan',
    intent: 'test',
    tasks: map,
    metadata: { modelUsed: 'test', createdAt: new Date().toISOString(), estimatedSteps: tasks.length },
  };
}

describe('DagScheduler & TaskExecutor', () => {
  it('executes tasks using decoupled DefaultTaskExecutor', async () => {
    const registry = new MockToolRegistry();
    registry.register('t1', async () => 'hello');
    registry.register('t2', async () => 'world');

    const executor = new DefaultTaskExecutor(registry as any);
    const scheduler = new DagScheduler(executor, { maxConcurrency: 2 });

    const plan = makeTestPlan([
      { id: 'step1', tool: 't1' },
      { id: 'step2', tool: 't2', deps: ['step1'] },
    ]);

    const result = await scheduler.schedule(plan as any);
    assert.equal(result.tasks.get('step1').status, 'completed');
    assert.equal(result.tasks.get('step1').result, 'hello');
    assert.equal(result.tasks.get('step2').status, 'completed');
    assert.equal(result.tasks.get('step2').result, 'world');
  });

  it('handles task failure and halts downstream tasks', async () => {
    const registry = new MockToolRegistry();
    registry.register('fail-tool', async () => { throw new Error('Permanent breakdown'); });
    registry.register('downstream', async () => 'never');

    const executor = new DefaultTaskExecutor(registry as any);
    const scheduler = new DagScheduler(executor);

    const plan = makeTestPlan([
      { id: 'failing', tool: 'fail-tool' },
      { id: 'dependent', tool: 'downstream', deps: ['failing'] },
    ]);

    const result = await scheduler.schedule(plan as any);
    assert.equal(result.tasks.get('failing').status, 'failed');
    assert.equal(result.tasks.get('dependent').status, 'pending');
  });
});
