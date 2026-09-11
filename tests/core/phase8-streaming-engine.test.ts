import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DagScheduler } from '../../packages/core/src/scheduler.js';
import { DefaultTaskExecutor } from '../../packages/core/src/task-executor.js';
import { AgentRunner } from '../../packages/core/src/agent-runner.js';
import { ExecutionEvent } from '../../packages/core/src/execution-state.js';

class MockToolRegistry {
  private tools = new Map<string, (args: any) => Promise<any>>();

  register(slug: string, handler: (args: any) => Promise<any>) {
    this.tools.set(slug, handler);
  }

  getDeclarativeSchemas() {
    return Array.from(this.tools.keys()).map((slug) => ({
      name: slug,
      slug,
      description: `Mock tool ${slug}`,
      parameters: { type: 'object', properties: {} },
    }));
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

function makeMultiLayerPlan() {
  const map = new Map();
  // Layer 0 tasks (parallel)
  map.set('task-a', {
    id: 'task-a',
    name: 'Task A',
    toolSlug: 'tool-a',
    arguments: {},
    dependencies: [],
    status: 'pending',
    retryCount: 0,
    maxRetries: 1,
  });
  map.set('task-b', {
    id: 'task-b',
    name: 'Task B',
    toolSlug: 'tool-b',
    arguments: {},
    dependencies: [],
    status: 'pending',
    retryCount: 0,
    maxRetries: 1,
  });
  // Layer 1 task (depends on a and b)
  map.set('task-c', {
    id: 'task-c',
    name: 'Task C',
    toolSlug: 'tool-c',
    arguments: {},
    dependencies: ['task-a', 'task-b'],
    status: 'pending',
    retryCount: 0,
    maxRetries: 1,
  });
  // Layer 2 task (depends on c)
  map.set('task-d', {
    id: 'task-d',
    name: 'Task D',
    toolSlug: 'tool-d',
    arguments: {},
    dependencies: ['task-c'],
    status: 'pending',
    retryCount: 0,
    maxRetries: 1,
  });

  return {
    id: 'multi-layer-plan',
    intent: 'Execute multi-stage workflow',
    tasks: map,
    metadata: {
      modelUsed: 'test-model',
      createdAt: new Date().toISOString(),
      estimatedSteps: 4,
    },
  };
}

describe('Phase 8 — Streaming Execution Engine', () => {
  it('emits events in strict progressive layer order with structured outputs', async () => {
    const registry = new MockToolRegistry();
    registry.register('tool-a', async () => ({ res: 'alpha' }));
    registry.register('tool-b', async () => ({ res: 'beta' }));
    registry.register('tool-c', async () => ({ res: 'gamma' }));
    registry.register('tool-d', async () => ({ res: 'delta' }));

    const executor = new DefaultTaskExecutor(registry as any);
    const scheduler = new DagScheduler(executor);

    const emittedEvents: ExecutionEvent[] = [];
    scheduler.onEvent((event) => {
      emittedEvents.push(event);
    });

    const plan = makeMultiLayerPlan();
    const executedPlan = await scheduler.schedule(plan as any);

    assert.equal(executedPlan.tasks.get('task-d')?.status, 'completed');

    // Verify events were captured
    const eventTypes = emittedEvents.map((e) => e.type);

    // 1. First event is execution.started
    assert.equal(eventTypes[0], 'execution.started');

    // 2. Contains layer.started and layer.completed for 3 layers
    const layerStartedEvents = emittedEvents.filter((e) => e.type === 'layer.started');
    const layerCompletedEvents = emittedEvents.filter((e) => e.type === 'layer.completed') as any[];

    assert.equal(layerStartedEvents.length, 3, 'Should start 3 layers');
    assert.equal(layerCompletedEvents.length, 3, 'Should complete 3 layers');

    // Layer 0 should contain task-a and task-b
    assert.deepEqual(layerCompletedEvents[0].layerResult.completedTasks.sort(), ['task-a', 'task-b']);
    assert.equal(layerCompletedEvents[0].layerIndex, 0);
    assert.equal(layerCompletedEvents[0].layerResult.nextLayer, 1);
    assert.deepEqual(layerCompletedEvents[0].layerResult.outputs['task-a'], { res: 'alpha' });
    assert.deepEqual(layerCompletedEvents[0].layerResult.outputs['task-b'], { res: 'beta' });

    // Layer 1 should contain task-c
    assert.deepEqual(layerCompletedEvents[1].layerResult.completedTasks, ['task-c']);
    assert.equal(layerCompletedEvents[1].layerIndex, 1);
    assert.equal(layerCompletedEvents[1].layerResult.nextLayer, 2);

    // Layer 2 should contain task-d and nextLayer is undefined
    assert.deepEqual(layerCompletedEvents[2].layerResult.completedTasks, ['task-d']);
    assert.equal(layerCompletedEvents[2].layerIndex, 2);
    assert.equal(layerCompletedEvents[2].layerResult.nextLayer, undefined);

    // 3. Final event is execution.completed
    const lastEvent = emittedEvents[emittedEvents.length - 1];
    assert.equal(lastEvent.type, 'execution.completed');
  });

  it('streams execution events via scheduleStream async generator', async () => {
    const registry = new MockToolRegistry();
    registry.register('tool-a', async () => 'data-a');
    registry.register('tool-b', async () => 'data-b');
    registry.register('tool-c', async () => 'data-c');
    registry.register('tool-d', async () => 'data-d');

    const executor = new DefaultTaskExecutor(registry as any);
    const scheduler = new DagScheduler(executor);

    const plan = makeMultiLayerPlan();
    const streamedEvents: ExecutionEvent[] = [];

    for await (const event of scheduler.scheduleStream(plan as any)) {
      streamedEvents.push(event);
    }

    assert.ok(streamedEvents.length > 5);
    assert.equal(streamedEvents[0].type, 'execution.started');
    assert.equal(streamedEvents[streamedEvents.length - 1].type, 'execution.completed');

    const taskCompleted = streamedEvents.filter((e) => e.type === 'task.completed');
    assert.equal(taskCompleted.length, 4);
  });

  it('emits execution.failed on layer failure and halts downstream execution', async () => {
    const registry = new MockToolRegistry();
    registry.register('tool-a', async () => 'ok');
    registry.register('tool-b', async () => {
      throw new Error('Fatal layer failure in B');
    });
    registry.register('tool-c', async () => 'should not run');
    registry.register('tool-d', async () => 'should not run');

    const executor = new DefaultTaskExecutor(registry as any);
    const scheduler = new DagScheduler(executor);

    const emittedEvents: ExecutionEvent[] = [];
    scheduler.onEvent((event) => {
      emittedEvents.push(event);
    });

    const plan = makeMultiLayerPlan();
    const resultPlan = await scheduler.schedule(plan as any);

    assert.equal(resultPlan.tasks.get('task-b')?.status, 'failed');
    assert.equal(resultPlan.tasks.get('task-c')?.status, 'pending');
    assert.equal(resultPlan.tasks.get('task-d')?.status, 'pending');

    const lastEvent = emittedEvents[emittedEvents.length - 1];
    assert.equal(lastEvent.type, 'execution.failed');
    assert.equal((lastEvent as any).layerIndex, 0);
  });

  it('AgentRunner subscribes to events and forwards progress to callers', async () => {
    const registry = new MockToolRegistry();
    registry.register('generate_mock', async () => ({ status: 'done' }));

    const mockAiService = {
      getCurrentModel: () => 'mock-model',
      generate: async () => 'AI completed response',
      generateStructuredOutput: async () => ({
        tasks: [
          {
            id: 'task-1',
            name: 'Step 1',
            toolSlug: 'generate_mock',
            arguments: {},
            dependencies: [],
          },
        ],
      }),
    };

    const runner = new AgentRunner(mockAiService as any, registry as any);

    const forwardedEvents: ExecutionEvent[] = [];
    const runResult = await runner.run('user-1', 'test runner goal', {
      onProgress: (event) => {
        forwardedEvents.push(event);
      },
    });

    assert.equal(runResult.status, 'completed');
    assert.ok(forwardedEvents.length >= 4);
    assert.ok(forwardedEvents.some((e) => e.type === 'execution.started'));
    assert.ok(forwardedEvents.some((e) => e.type === 'layer.started'));
    assert.ok(forwardedEvents.some((e) => e.type === 'layer.completed'));
    assert.ok(forwardedEvents.some((e) => e.type === 'execution.completed'));
  });

  it('AgentRunner.runStream yields execution events progressively', async () => {
    const registry = new MockToolRegistry();
    registry.register('generate_mock', async () => ({ status: 'done' }));

    const mockAiService = {
      getCurrentModel: () => 'mock-model',
      generate: async () => 'AI completed response',
      generateStructuredOutput: async () => ({
        tasks: [
          {
            id: 'task-1',
            name: 'Step 1',
            toolSlug: 'generate_mock',
            arguments: {},
            dependencies: [],
          },
        ],
      }),
    };

    const runner = new AgentRunner(mockAiService as any, registry as any);
    const streamed: ExecutionEvent[] = [];

    for await (const evt of runner.runStream('user-1', 'test runner goal')) {
      streamed.push(evt);
    }

    assert.ok(streamed.length >= 4);
    assert.equal(streamed[0].type, 'execution.started');
    assert.equal(streamed[streamed.length - 1].type, 'execution.completed');
  });
});
