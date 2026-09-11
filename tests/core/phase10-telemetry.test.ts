import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  TelemetryEngine,
  createTelemetryEngine,
  ExecutionTrace,
  ExecutionMetrics,
} from '../../packages/core/src/telemetry.js';
import { DagScheduler } from '../../packages/core/src/scheduler.js';
import { DefaultTaskExecutor } from '../../packages/core/src/task-executor.js';
import { ExecutionState } from '../../packages/core/src/execution-state.js';
import {
  Logger,
  createStructuredLogger,
  LogCategory,
  StructuredLogEntry,
} from '../../packages/shared/src/logger/index.js';
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

function makeTelemetryPlan(planId: string = 'telemetry-plan-1'): ExecutionPlan {
  const map = new Map();
  // Layer 0: fast tool and slow tool
  map.set('task-fast', {
    id: 'task-fast',
    name: 'Fast Task',
    toolSlug: 'tool-fast',
    arguments: {},
    dependencies: [],
    status: 'pending',
    retryCount: 0,
    maxRetries: 2,
  });
  map.set('task-calc', {
    id: 'task-calc',
    name: 'Calc Task',
    toolSlug: 'tool-calc',
    arguments: { val: 42 },
    dependencies: [],
    status: 'pending',
    retryCount: 0,
    maxRetries: 2,
  });
  // Layer 1: downstream task
  map.set('task-summary', {
    id: 'task-summary',
    name: 'Summary Task',
    toolSlug: 'tool-summary',
    arguments: {},
    dependencies: ['task-fast', 'task-calc'],
    status: 'pending',
    retryCount: 0,
    maxRetries: 2,
  });

  return {
    id: planId,
    tasks: map,
    intent: 'benchmark telemetry and observability',
    metadata: { test: true },
  };
}

describe('Phase 10 — Execution Telemetry & Developer Diagnostics', () => {
  describe('Step 1: TelemetryEngine Independent Unit Tests', () => {
    it('generates unique execution trace ID and tracks execution lifecycle', () => {
      const telemetry1 = createTelemetryEngine();
      const telemetry2 = createTelemetryEngine();

      assert.ok(telemetry1.getTraceId().startsWith('trace-'));
      assert.notStrictEqual(telemetry1.getTraceId(), telemetry2.getTraceId());

      telemetry1.startExecution('exec-1', { custom: 'data' });
      const trace = telemetry1.getTrace();
      assert.strictEqual(trace.executionId, 'exec-1');
      assert.strictEqual(trace.metadata?.custom, 'data');
      assert.ok(trace.startedAt > 0);

      telemetry1.endExecution(true, 150);
      const finishedTrace = telemetry1.getTrace();
      assert.strictEqual(finishedTrace.success, true);
      assert.strictEqual(finishedTrace.totalDurationMs, 150);
    });

    it('records layer durations, task timings, tool usage and model usage', () => {
      const telemetry = createTelemetryEngine('trace-unit-1');

      telemetry.startExecution('plan-unit');
      telemetry.recordLayerStart(0, ['t1', 't2']);
      telemetry.recordTaskStart('t1', 'search');
      telemetry.recordTaskEnd('t1', 45, true, undefined, 'search', 0);
      telemetry.recordToolUsage('search', 45, true);

      telemetry.recordTaskStart('t2', 'db_query');
      telemetry.recordTaskEnd('t2', 80, true, undefined, 'db_query', 0);
      telemetry.recordToolUsage('db_query', 80, true);

      telemetry.recordLayerEnd(0, 90, true);

      telemetry.recordModelUsage('gemini-1.5-pro', {
        promptTokens: 250,
        completionTokens: 100,
        totalTokens: 350,
      });

      telemetry.recordContextSize(3, 4096, 2);
      telemetry.endExecution(true, 120);

      const metrics = telemetry.getMetrics();
      assert.strictEqual(metrics.totalDurationMs, 120);
      assert.strictEqual(metrics.tasksTotal, 2);
      assert.strictEqual(metrics.tasksCompleted, 2);
      assert.strictEqual(metrics.tasksFailed, 0);

      assert.strictEqual(metrics.toolUsage['search'].count, 1);
      assert.strictEqual(metrics.toolUsage['search'].totalDurationMs, 45);
      assert.strictEqual(metrics.toolUsage['db_query'].count, 1);
      assert.strictEqual(metrics.toolUsage['db_query'].totalDurationMs, 80);

      assert.strictEqual(metrics.modelUsage['gemini-1.5-pro'].invocations, 1);
      assert.strictEqual(metrics.modelUsage['gemini-1.5-pro'].totalTokens, 350);

      assert.strictEqual(metrics.contextMetrics.peakFilesLoaded, 3);
      assert.strictEqual(metrics.contextMetrics.peakFileBytesLoaded, 4096);
      assert.strictEqual(metrics.contextMetrics.peakMemoriesRetrieved, 2);

      const slowestTool = telemetry.getSlowestTool();
      assert.strictEqual(slowestTool?.slug, 'db_query');
    });

    it('answers core developer questions: slow layers, memory, token usage, failures', () => {
      const telemetry = createTelemetryEngine('trace-qa');
      telemetry.startExecution('plan-qa');

      telemetry.recordLayerStart(0, ['t1']);
      telemetry.recordLayerEnd(0, 50, true);

      telemetry.recordLayerStart(1, ['t2']);
      telemetry.recordLayerEnd(1, 350, false, 'Network timeout');
      telemetry.recordFailure('Network timeout', { layerIndex: 1, taskId: 't2' });

      telemetry.endExecution(false, 400);

      const slowestLayer = telemetry.getSlowestLayer();
      assert.strictEqual(slowestLayer?.layerIndex, 1);
      assert.strictEqual(slowestLayer?.durationMs, 350);

      const diagnostics = telemetry.getDiagnostics();
      assert.strictEqual(diagnostics.diagnostics.slowestLayer?.layerIndex, 1);
      assert.strictEqual(diagnostics.trace.failures.length, 1);
      assert.strictEqual(diagnostics.trace.failures[0].error, 'Network timeout');
    });
  });

  describe('Step 2: Structured JSON Logging inside packages/shared', () => {
    it('outputs structured log entries with correct metadata, category, and level', () => {
      const entries: StructuredLogEntry[] = [];
      const logger = new Logger(LogCategory.SCHEDULER, {
        minLevel: 'debug',
        transport: (entry) => entries.push(entry),
      });

      logger.debug('Debug event', { step: 1 });
      logger.info('Scheduler started', { planId: 'p-1' });
      logger.warn('Prerequisite warning', { missing: 'cache' });
      logger.error('Layer failure', new Error('Execution failed'));

      assert.strictEqual(entries.length, 4);
      assert.strictEqual(entries[0].level, 'debug');
      assert.strictEqual(entries[0].category, LogCategory.SCHEDULER);
      assert.strictEqual(entries[0].metadata?.step, 1);

      assert.strictEqual(entries[1].level, 'info');
      assert.strictEqual(entries[1].metadata?.planId, 'p-1');

      assert.strictEqual(entries[3].level, 'error');
      assert.strictEqual(entries[3].message, 'Layer failure');
      assert.strictEqual(entries[3].metadata?.error, 'Execution failed');
    });

    it('supports child loggers with contextual traceId', () => {
      const entries: StructuredLogEntry[] = [];
      const rootLogger = new Logger(LogCategory.RUNNER, {
        transport: (entry) => entries.push(entry),
      });

      const child = rootLogger.withContext({ traceId: 'trace-custom-99' });
      child.info('Child operation started');

      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].traceId, 'trace-custom-99');
      assert.strictEqual(entries[0].message, 'Child operation started');
    });
  });

  describe('Step 3: Scheduler Automatic Instrumentation', () => {
    it('instruments DagScheduler automatically and collects execution metrics', async () => {
      const registry = new MockToolRegistry();
      registry.register('tool-fast', async () => ({ value: 'fast-done' }));
      registry.register('tool-calc', async (args) => ({ doubled: (args.val || 1) * 2 }));
      registry.register('tool-summary', async () => ({ summary: 'all tasks done' }));

      const scheduler = new DagScheduler(registry);
      const plan = makeTelemetryPlan('plan-telemetry-auto');

      const executedPlan = await scheduler.schedule(plan);

      // Verify execution correctness is untouched
      assert.strictEqual(executedPlan.tasks.get('task-fast')?.status, 'completed');
      assert.strictEqual(executedPlan.tasks.get('task-calc')?.status, 'completed');
      assert.strictEqual(executedPlan.tasks.get('task-summary')?.status, 'completed');

      // Verify Diagnostics collected
      const diagnostics = scheduler.getDiagnostics();
      assert.ok(diagnostics, 'Diagnostics must be present on scheduler');
      assert.strictEqual(diagnostics.trace.planId, 'plan-telemetry-auto');
      assert.strictEqual(diagnostics.trace.success, true);
      assert.strictEqual(diagnostics.metrics.tasksCompleted, 3);
      assert.strictEqual(diagnostics.metrics.tasksFailed, 0);

      // Verify Layer tracking
      assert.strictEqual(diagnostics.trace.layers.length, 2);
      assert.strictEqual(diagnostics.trace.layers[0].layerIndex, 0);
      assert.strictEqual(diagnostics.trace.layers[1].layerIndex, 1);

      // Verify Tool Usage
      assert.strictEqual(diagnostics.metrics.toolUsage['tool-fast'].count, 1);
      assert.strictEqual(diagnostics.metrics.toolUsage['tool-calc'].count, 1);
      assert.strictEqual(diagnostics.metrics.toolUsage['tool-summary'].count, 1);
    });

    it('records failure telemetry without disrupting error reporting or control flow', async () => {
      const registry = new MockToolRegistry();
      registry.register('tool-fast', async () => {
        throw new Error('Simulated tool crash');
      });
      registry.register('tool-calc', async () => ({ ok: true }));
      registry.register('tool-summary', async () => ({ ok: true }));

      const scheduler = new DagScheduler(registry);
      const plan = makeTelemetryPlan('plan-telemetry-failure');

      await scheduler.schedule(plan);

      const diagnostics = scheduler.getDiagnostics();
      assert.ok(diagnostics);
      assert.strictEqual(diagnostics.trace.success, false);
      assert.ok(diagnostics.metrics.tasksFailed > 0);
      assert.ok(diagnostics.trace.failures.length > 0);
      assert.ok(diagnostics.trace.failures[0].error.includes('Simulated tool crash'));
    });
  });

  describe('Step 4: ExecutionState Extension with Telemetry Diagnostics', () => {
    it('attaches telemetry diagnostics to ExecutionState without storing raw files or memories', () => {
      const plan = makeTelemetryPlan('state-telemetry-plan');
      const telemetry = createTelemetryEngine('trace-state-test');
      telemetry.startExecution('state-telemetry-plan');
      telemetry.recordToolUsage('tool-fast', 20, true);
      telemetry.endExecution(true, 50);

      const state = new ExecutionState(plan, plan.intent, plan.metadata, plan.tasks);
      state.setTelemetry(telemetry.getDiagnostics());

      const summary = state.getSummary();
      assert.ok(summary.telemetry);
      assert.strictEqual(summary.telemetry.traceId, 'trace-state-test');
      assert.strictEqual(summary.telemetry.metrics.toolUsage['tool-fast'].count, 1);

      // Enforce strict memory cleanliness rule
      assert.strictEqual((state as any).files, undefined);
      assert.strictEqual((state as any).memories, undefined);
      assert.strictEqual(summary.files, undefined);
      assert.strictEqual(summary.memories, undefined);
    });
  });

  describe('Step 5: Telemetry Observational Invariance Principle', () => {
    it('ensures telemetry never controls or alters execution results', async () => {
      const registry = new MockToolRegistry();
      registry.register('tool-fast', async () => ({ code: 200 }));
      registry.register('tool-calc', async () => ({ code: 200 }));
      registry.register('tool-summary', async () => ({ code: 200 }));

      const planA = makeTelemetryPlan('plan-a');
      const planB = makeTelemetryPlan('plan-b');

      // Run A with scheduler creating its own telemetry
      const schedulerA = new DagScheduler(registry);
      const resultA = await schedulerA.schedule(planA);

      // Run B with explicit custom telemetry engine
      const customTelemetry = createTelemetryEngine('custom-trace-b');
      const schedulerB = new DagScheduler(registry, { telemetryEngine: customTelemetry });
      const resultB = await schedulerB.schedule(planB);

      // Verify identical functional state
      for (const [taskId, taskA] of resultA.tasks) {
        const taskB = resultB.tasks.get(taskId);
        assert.ok(taskB);
        assert.strictEqual(taskA.status, taskB.status);
        assert.deepStrictEqual(taskA.result, taskB.result);
      }
    });
  });
});
