import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DagScheduler } from '../../packages/core/src/scheduler.js';
import { DefaultTaskExecutor } from '../../packages/core/src/task-executor.js';
import { AgentRunner } from '../../packages/core/src/agent-runner.js';
import { ExecutionState, ExecutionEvent } from '../../packages/core/src/execution-state.js';
import {
  InMemoryCheckpointStore,
  classifyFailure,
  ExecutionCheckpoint,
} from '../../packages/core/src/checkpoint.js';
import type { ExecutionPlan } from '@ai-agent-platform/shared';

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

function makeResumablePlan(planId: string = 'resumable-plan-1'): ExecutionPlan {
  const map = new Map();
  // Layer 0: Task A & Task B
  map.set('task-a', {
    id: 'task-a',
    name: 'Task A',
    toolSlug: 'tool-a',
    arguments: {},
    dependencies: [],
    status: 'pending',
    retryCount: 0,
    maxRetries: 2,
  });
  map.set('task-b', {
    id: 'task-b',
    name: 'Task B',
    toolSlug: 'tool-b',
    arguments: {},
    dependencies: [],
    status: 'pending',
    retryCount: 0,
    maxRetries: 2,
  });
  // Layer 1: Task C (depends on A and B)
  map.set('task-c', {
    id: 'task-c',
    name: 'Task C',
    toolSlug: 'tool-c',
    arguments: {},
    dependencies: ['task-a', 'task-b'],
    status: 'pending',
    retryCount: 0,
    maxRetries: 2,
  });
  // Layer 2: Task D (depends on C)
  map.set('task-d', {
    id: 'task-d',
    name: 'Task D',
    toolSlug: 'tool-d',
    arguments: {},
    dependencies: ['task-c'],
    status: 'pending',
    retryCount: 0,
    maxRetries: 2,
  });

  return {
    id: planId,
    tasks: map,
    intent: 'execute resumable pipeline',
    metadata: { test: true },
  };
}

describe('Phase 9 — Resumable Execution Runtime & Checkpointing', () => {
  it('Step 1: Checkpoint Store persists and retrieves checkpoints cleanly', async () => {
    const store = new InMemoryCheckpointStore();
    const checkpoint: ExecutionCheckpoint = {
      executionId: 'plan-101',
      completedTasks: ['task-1', 'task-2'],
      outputs: { 'task-1': 'output-1', 'task-2': 'output-2' },
      currentLayer: 0,
      timestamp: new Date().toISOString(),
      metadata: { totalLayers: 3 },
    };

    await store.saveCheckpoint(checkpoint);
    const loaded = await store.loadCheckpoint('plan-101');
    assert.ok(loaded);
    assert.equal(loaded?.executionId, 'plan-101');
    assert.deepEqual(loaded?.completedTasks, ['task-1', 'task-2']);
    assert.equal(loaded?.outputs['task-1'], 'output-1');

    // Verify list and delete
    const all = await store.listCheckpoints();
    assert.equal(all.length, 1);
    await store.deleteCheckpoint('plan-101');
    const empty = await store.loadCheckpoint('plan-101');
    assert.equal(empty, null);
  });

  it('Step 2: Classifies failures correctly according to recovery policy', () => {
    // Tool errors, timeouts, validation failures -> retry_task
    const toolErr = classifyFailure('Tool execution failed with status 500');
    assert.equal(toolErr.type, 'tool_error');
    assert.equal(toolErr.recovery, 'retry_task');

    const timeoutErr = classifyFailure('Model request timed out after 30000ms');
    assert.equal(timeoutErr.type, 'model_timeout');
    assert.equal(timeoutErr.recovery, 'retry_task');

    const valErr = classifyFailure('Schema validation failed: missing required parameter');
    assert.equal(valErr.type, 'validation_failure');
    assert.equal(valErr.recovery, 'retry_task');

    // Dependency errors, cycles, deadlocks -> abort
    const depErr = classifyFailure('Deadlock detected! Unresolved tasks');
    assert.equal(depErr.type, 'dependency_error');
    assert.equal(depErr.recovery, 'abort');

    const cycleErr = classifyFailure('Plan contains a circular dependency cycle');
    assert.equal(cycleErr.type, 'dependency_error');
    assert.equal(cycleErr.recovery, 'abort');

    // Scheduler crash / worker killed -> resume_checkpoint
    const crashErr = classifyFailure('Worker SIGKILL scheduler crashed unexpected exit');
    assert.equal(crashErr.type, 'scheduler_crash');
    assert.equal(crashErr.recovery, 'resume_checkpoint');
  });

  it('Step 3: Saves checkpoint automatically after each successful layer', async () => {
    const registry = new MockToolRegistry();
    registry.register('tool-a', async () => 'result-a');
    registry.register('tool-b', async () => 'result-b');
    registry.register('tool-c', async () => 'result-c');
    registry.register('tool-d', async () => 'result-d');

    const checkpointStore = new InMemoryCheckpointStore();
    const executor = new DefaultTaskExecutor(registry as any);
    const scheduler = new DagScheduler(executor, {
      checkpointStore,
      autoCheckpoint: true,
    });

    const emittedEvents: ExecutionEvent[] = [];
    scheduler.onEvent((event) => emittedEvents.push(event));

    const plan = makeResumablePlan('plan-checkpoint-flow');
    await scheduler.schedule(plan);

    // Verify layer.completed events contain checkpoint data
    const layerCompletedEvents = emittedEvents.filter((e) => e.type === 'layer.completed');
    assert.equal(layerCompletedEvents.length, 3);
    for (const evt of layerCompletedEvents) {
      assert.ok(evt.checkpoint, 'Each layer.completed event must contain a checkpoint');
    }

    // Verify final saved checkpoint
    const finalCp = await checkpointStore.loadCheckpoint('plan-checkpoint-flow');
    assert.ok(finalCp);
    assert.equal(finalCp?.completedTasks.length, 4);
    assert.equal(finalCp?.outputs['task-a'], 'result-a');
    assert.equal(finalCp?.outputs['task-d'], 'result-d');
  });

  it('Step 4: Resumes from checkpoint and skips already completed tasks after failure', async () => {
    const executedTasks: string[] = [];

    const registry = new MockToolRegistry();
    let cShouldFail = true;

    registry.register('tool-a', async () => {
      executedTasks.push('task-a');
      return 'val-a';
    });
    registry.register('tool-b', async () => {
      executedTasks.push('task-b');
      return 'val-b';
    });
    registry.register('tool-c', async () => {
      executedTasks.push('task-c');
      if (cShouldFail) {
        throw new Error('Unrecoverable pipeline failure in task-c');
      }
      return 'val-c';
    });
    registry.register('tool-d', async () => {
      executedTasks.push('task-d');
      return 'val-d';
    });

    const checkpointStore = new InMemoryCheckpointStore();
    const executor = new DefaultTaskExecutor(registry as any);

    // ── First Run: Layer 0 succeeds, Layer 1 fails ──
    const scheduler1 = new DagScheduler(executor, {
      checkpointStore,
      autoCheckpoint: true,
    });

    const plan1 = makeResumablePlan('plan-resume-demo');
    const result1 = await scheduler1.schedule(plan1);

    assert.equal(result1.tasks.get('task-a')?.status, 'completed');
    assert.equal(result1.tasks.get('task-b')?.status, 'completed');
    assert.equal(result1.tasks.get('task-c')?.status, 'failed');
    assert.equal(result1.tasks.get('task-d')?.status, 'pending');

    // Layer 0 completed tasks: task-a, task-b; task-c was attempted and retried before layer failed
    assert.deepEqual(executedTasks, ['task-a', 'task-b', 'task-c', 'task-c']);

    // Checkpoint in store must only hold completed Layer 0 tasks
    const cpAfterFailure = await checkpointStore.loadCheckpoint('plan-resume-demo');
    assert.ok(cpAfterFailure);
    assert.deepEqual(cpAfterFailure?.completedTasks.sort(), ['task-a', 'task-b']);
    assert.equal(cpAfterFailure?.currentLayer, 0);

    // ── Second Run: Resume from checkpoint (Task C now succeeds) ──
    cShouldFail = false;
    executedTasks.length = 0; // reset execution log

    const scheduler2 = new DagScheduler(executor, {
      checkpointStore,
      autoCheckpoint: true,
    });

    const plan2 = makeResumablePlan('plan-resume-demo');
    const result2 = await scheduler2.schedule(plan2);

    // CRITICAL RESUMABLE PROPERTY:
    // task-a and task-b MUST NOT be re-executed!
    assert.deepEqual(executedTasks, ['task-c', 'task-d']);

    // All tasks completed in plan2
    assert.equal(result2.tasks.get('task-a')?.status, 'completed');
    assert.equal(result2.tasks.get('task-b')?.status, 'completed');
    assert.equal(result2.tasks.get('task-c')?.status, 'completed');
    assert.equal(result2.tasks.get('task-d')?.status, 'completed');

    // Results from Layer 0 were preserved from checkpoint
    assert.equal(result2.tasks.get('task-a')?.result, 'val-a');
    assert.equal(result2.tasks.get('task-b')?.result, 'val-b');
    assert.equal(result2.tasks.get('task-c')?.result, 'val-c');
    assert.equal(result2.tasks.get('task-d')?.result, 'val-d');
  });

  it('Step 5: Retries transient task errors locally before failing the layer', async () => {
    const registry = new MockToolRegistry();
    let attempts = 0;

    registry.register('tool-a', async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Tool rate limit exceeded: HTTP 429');
      }
      return 'recovered-tool-a';
    });
    registry.register('tool-b', async () => 'data-b');
    registry.register('tool-c', async () => 'data-c');
    registry.register('tool-d', async () => 'data-d');

    const executor = new DefaultTaskExecutor(registry as any);
    const scheduler = new DagScheduler(executor);

    const plan = makeResumablePlan('retry-transient-plan');
    const resultPlan = await scheduler.schedule(plan);

    assert.equal(attempts, 2, 'task-a should have been retried after transient 429 error');
    assert.equal(resultPlan.tasks.get('task-a')?.status, 'completed');
    assert.equal(resultPlan.tasks.get('task-a')?.result, 'recovered-tool-a');
    assert.equal(resultPlan.tasks.get('task-d')?.status, 'completed');
  });

  it('Step 6: AgentRunner.resume restores workflow state and completes execution', async () => {
    const executedSlugs: string[] = [];

    const registry = new MockToolRegistry();
    registry.register('generate_mock_a', async () => {
      executedSlugs.push('a');
      return 'out-a';
    });
    registry.register('generate_mock_b', async () => {
      executedSlugs.push('b');
      return 'out-b';
    });

    const checkpointStore = new InMemoryCheckpointStore();
    // Simulate pre-existing checkpoint where task-1 is already completed
    await checkpointStore.saveCheckpoint({
      executionId: 'runner-resume-plan',
      completedTasks: ['task-1'],
      outputs: { 'task-1': 'out-a' },
      currentLayer: 0,
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    const mockAiService = {
      getCurrentModel: () => 'mock-model',
      generate: async () => 'Synthesized final answer from runner',
      generateStructuredOutput: async () => ({}),
    };

    const runner = new AgentRunner(mockAiService as any, {
      registry: registry as any,
      checkpointStore,
    });

    const plan: ExecutionPlan = {
      id: 'runner-resume-plan',
      intent: 'test runner resume',
      tasks: new Map([
        [
          'task-1',
          {
            id: 'task-1',
            name: 'Task 1',
            toolSlug: 'generate_mock_a',
            arguments: {},
            dependencies: [],
            status: 'pending',
            retryCount: 0,
          },
        ],
        [
          'task-2',
          {
            id: 'task-2',
            name: 'Task 2',
            toolSlug: 'generate_mock_b',
            arguments: {},
            dependencies: ['task-1'],
            status: 'pending',
            retryCount: 0,
          },
        ],
      ]),
    };

    const res = await runner.resume(plan);
    assert.equal(res.status, 'completed');
    // Task 1 was pre-completed in the checkpoint, so only tool b should execute
    assert.deepEqual(executedSlugs, ['b']);
  });
});
