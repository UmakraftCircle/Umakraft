import { createLogger } from '@ai-agent-platform/shared';
import { AIService } from '@ai-agent-platform/ai';
import { Planner } from './planner.js';
import { TaskManager } from './task-manager.js';
import { DagScheduler, ExecutionEvent, ExecutionEventListener } from './scheduler.js';
import { ToolRegistry } from './tool-registry.js';
import { ModelRouter } from './model-router.js';
import type { ExecutionPlan, AgentTask } from '@ai-agent-platform/shared';
import type { CheckpointStore, ExecutionCheckpoint } from './checkpoint.js';
import type { ExecutionDiagnostics } from './telemetry.js';

const logger = createLogger('AgentRunner');

export interface RunLimits {
  maxPlanSteps: number;
  maxToolCalls: number;
  maxWebSearches: number;
  maxRetriesPerStep: number;
  perToolTimeoutMs: number;
  overallTimeoutMs: number;
  maxResultBytes: number;
  maxContextBytes: number;
}

export const DEFAULT_RUN_LIMITS: RunLimits = {
  maxPlanSteps: 8,
  maxToolCalls: 10,
  maxWebSearches: 3,
  maxRetriesPerStep: 3,
  perToolTimeoutMs: 10_000,
  overallTimeoutMs: 60_000,
  maxResultBytes: 64 * 1024,
  maxContextBytes: 2000,
};

export interface AgentRunResult {
  taskId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'timeout';
  answer: string;
  stepsExecuted: number;
  toolCalls: number;
  webSearches: number;
  errors: string[];
  toolNamesUsed: string[];
  durationMs: number;
  traceId?: string;
  telemetry?: ExecutionDiagnostics;
}

export interface TaskStateStoreLike {
  create(state: { taskId: string; userId: string; guildId: string | null; channelId: string | null; goal: string; currentStep: number }): Promise<void>;
  update(taskId: string, patch: Record<string, any>): Promise<void>;
}

export interface AgentRunnerOptions {
  registry?: ToolRegistry;
  taskStore?: TaskStateStoreLike;
  checkpointStore?: CheckpointStore;
  checkpoint?: ExecutionCheckpoint;
  limits?: RunLimits;
  scheduler?: DagScheduler;
  taskManager?: TaskManager;
  modelRouter?: ModelRouter;
  onProgress?: ExecutionEventListener;
}

const WEB_SEARCH_SLUG = 'search_web';

function byteLen(s: string): number { return Buffer.byteLength(s, 'utf8'); }

function truncate(s: string, maxBytes: number): string {
  if (byteLen(s) <= maxBytes) return s;
  let out = s.slice(0, maxBytes);
  while (byteLen(out) > maxBytes) out = out.slice(0, out.length - 1);
  return out + '…[truncated]';
}

function makeTaskId(): string { return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

/**
 * Phase 8: Agent Runner — Streaming Execution Entry Point
 *
 * Responsibilities:
 * - Start scheduler
 * - Subscribe to execution events
 * - Forward progress to caller
 * - Return final response
 *
 * The runner does NOT execute tasks directly; it delegates execution entirely to DagScheduler.
 */
export class AgentRunner {
  private registry: ToolRegistry;
  private taskStore?: TaskStateStoreLike;
  private limits: RunLimits;
  private scheduler?: DagScheduler;
  private taskManager?: TaskManager;
  private modelRouter?: ModelRouter;
  private progressListeners: Set<ExecutionEventListener> = new Set();
  private checkpointStore?: CheckpointStore;
  private checkpoint?: ExecutionCheckpoint;

  constructor(
    private aiService: AIService,
    registryOrOptions?: ToolRegistry | AgentRunnerOptions,
    taskStore?: TaskStateStoreLike,
    limits?: RunLimits,
  ) {
    if (registryOrOptions && ('register' in registryOrOptions || 'execute' in registryOrOptions)) {
      this.registry = registryOrOptions as ToolRegistry;
      this.taskStore = taskStore;
      this.limits = limits ?? DEFAULT_RUN_LIMITS;
    } else if (registryOrOptions && typeof registryOrOptions === 'object') {
      const opts = registryOrOptions as AgentRunnerOptions;
      this.registry = opts.registry ?? ToolRegistry.getInstance();
      this.taskStore = opts.taskStore;
      this.limits = opts.limits ?? DEFAULT_RUN_LIMITS;
      this.scheduler = opts.scheduler;
      this.taskManager = opts.taskManager;
      this.modelRouter = opts.modelRouter;
      this.checkpointStore = opts.checkpointStore;
      this.checkpoint = opts.checkpoint;
      if (opts.onProgress) {
        this.progressListeners.add(opts.onProgress);
      }
    } else {
      this.registry = ToolRegistry.getInstance();
      this.taskStore = taskStore;
      this.limits = limits ?? DEFAULT_RUN_LIMITS;
    }
  }

  /**
   * Returns the checkpoint store used by the runner.
   */
  public getCheckpointStore(): CheckpointStore | undefined {
    return this.checkpointStore;
  }

  /**
   * Sets the checkpoint store used by the runner.
   */
  public setCheckpointStore(store: CheckpointStore): void {
    this.checkpointStore = store;
  }

  /**
   * Subscribes a listener to progress events emitted during plan execution.
   */
  public onProgress(listener: ExecutionEventListener): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  /**
   * Resumes execution of a plan from an existing checkpoint or execution ID.
   * Loads checkpoint, restores state, skips completed tasks, and resumes scheduler.
   */
  public async resume(
    plan: ExecutionPlan,
    checkpointOrExecutionId?: ExecutionCheckpoint | string,
    context?: {
      userId?: string;
      guildId?: string | null;
      channelId?: string | null;
      onProgress?: ExecutionEventListener;
    }
  ): Promise<AgentRunResult> {
    let resolvedCheckpoint: ExecutionCheckpoint | undefined;
    if (typeof checkpointOrExecutionId === 'string') {
      if (this.checkpointStore) {
        resolvedCheckpoint = (await this.checkpointStore.loadCheckpoint(checkpointOrExecutionId)) ?? undefined;
      }
    } else if (checkpointOrExecutionId) {
      resolvedCheckpoint = checkpointOrExecutionId;
    }

    return this.run(context?.userId ?? 'resume-user', plan.intent, {
      ...context,
      plan,
      checkpoint: resolvedCheckpoint,
      executionId: plan.id,
    });
  }

  /**
   * Runs the agent workflow, subscribing to scheduler events and returning the final response.
   */
  async run(
    userId: string,
    goal: string,
    context?: {
      guildId?: string | null;
      channelId?: string | null;
      onProgress?: ExecutionEventListener;
      checkpoint?: ExecutionCheckpoint;
      executionId?: string;
      plan?: ExecutionPlan;
    }
  ): Promise<AgentRunResult> {
    const taskId = makeTaskId();
    const startedAt = Date.now();
    const toolNamesUsed: string[] = [];
    const seenActions = new Set<string>();
    let webSearches = 0;
    const errors: string[] = [];

    const persist = async (patch: Record<string, any>) => {
      if (!this.taskStore) return;
      try { await this.taskStore.update(taskId, patch); } catch (err: any) { logger.warn(`persist failed for ${taskId}: ${err?.message}`); }
    };

    try {
      if (this.taskStore) {
        await this.taskStore.create({ taskId, userId, guildId: context?.guildId ?? null, channelId: context?.channelId ?? null, goal, currentStep: 0 })
          .catch((err: any) => logger.warn(`task create failed: ${err?.message}`));
      }

      // Check model router if available
      if (this.modelRouter) {
        try {
          const decision = this.modelRouter.route({
            promptLength: Math.ceil(goal.length / 4),
            requiresStructuredOutput: true,
            requiresVision: false,
          });
          logger.info(`ModelRouter suggested ${decision.model.name} for plan: ${decision.reason}`);
        } catch (err: any) {
          logger.warn(`ModelRouter evaluation bypassed: ${err?.message}`);
        }
      }

      let plan: ExecutionPlan;
      if (context?.plan) {
        plan = context.plan;
      } else {
        const planner = new Planner(this.aiService, this.registry);
        try {
          plan = await this.withOverallTimeout(() => planner.plan(goal));
        } catch (err: any) {
          await persist({ status: 'failed' });
          return this.result(taskId, 'failed', 'Planning failed.', 0, 0, webSearches, [err?.message ?? 'planning error'], [], startedAt);
        }
      }

      const taskCount = plan.tasks.size;
      if (taskCount > this.limits.maxPlanSteps) {
        const msg = `Plan exceeded ${this.limits.maxPlanSteps} steps (got ${taskCount}).`;
        await persist({ status: 'failed' });
        return this.result(taskId, 'failed', 'Plan was too complex.', 0, 0, webSearches, [msg], [], startedAt);
      }

      // Checkpoint loading and restoration
      const checkpoint =
        context?.checkpoint ??
        this.checkpoint ??
        (context?.executionId && this.checkpointStore
          ? await this.checkpointStore.loadCheckpoint(context.executionId)
          : (this.checkpointStore ? await this.checkpointStore.loadCheckpoint(plan.id) : null));

      await persist({ status: 'running', planJson: null, currentStep: 0 });

      // Start Scheduler as the streaming execution engine
      const scheduler = this.scheduler ?? new DagScheduler(this.registry, {
        taskManager: this.taskManager,
        checkpointStore: this.checkpointStore,
      });

      // Subscribe to execution events and forward progress to caller
      const unsubscribe = scheduler.onEvent(async (event) => {
        if (context?.onProgress) {
          try {
            await context.onProgress(event);
          } catch (e: any) {
            logger.warn(`context.onProgress error: ${e?.message}`);
          }
        }
        for (const listener of this.progressListeners) {
          try {
            await listener(event);
          } catch (e: any) {
            logger.warn(`progress listener error: ${e?.message}`);
          }
        }

        // Forward runtime progress on layer completion to taskStore
        if (event.type === 'layer.completed') {
          await persist({
            status: 'running',
            currentStep: event.progress.completed,
            currentLayer: event.layerIndex,
            progressPercentage: event.progress.percentage,
            checkpoint: event.checkpoint,
          });
        }
      });

      let executed: ExecutionPlan;
      try {
        executed = await this.withOverallTimeout(() =>
          scheduler.schedule(plan, undefined, { checkpoint: checkpoint ?? undefined })
        );
      } catch (err: any) {
        await persist({ status: 'failed' });
        const diagnostics = scheduler.getDiagnostics();
        return this.result(taskId, 'failed', 'Execution error.', taskCount, 0, webSearches, [err?.message ?? 'execution error'], [], startedAt, diagnostics);
      } finally {
        unsubscribe();
      }

      let toolCalls = 0;
      for (const task of executed.tasks.values()) {
        const slug = task.toolSlug;
        toolNamesUsed.push(slug);
        toolCalls++;
        if (slug === WEB_SEARCH_SLUG) webSearches++;
        if (task.error) errors.push(`[${task.id}] ${task.error}`);
        const actionKey = `${slug}:${JSON.stringify(task.arguments || {})}`;
        if (seenActions.has(actionKey)) logger.warn(`duplicate action: ${actionKey}`);
        seenActions.add(actionKey);
      }

      const diagnostics = scheduler.getDiagnostics();

      if (toolCalls > this.limits.maxToolCalls) {
        const msg = `tool-call limit ${this.limits.maxToolCalls} exceeded (${toolCalls})`;
        await persist({ status: 'failed' });
        return this.result(taskId, 'failed', 'Too many tool calls.', executed.tasks.size, toolCalls, webSearches, [msg], toolNamesUsed, startedAt, diagnostics);
      }
      if (webSearches > this.limits.maxWebSearches) {
        const msg = `web-search limit ${this.limits.maxWebSearches} exceeded (${webSearches})`;
        await persist({ status: 'failed' });
        return this.result(taskId, 'failed', 'Too many web searches.', executed.tasks.size, toolCalls, webSearches, [msg], toolNamesUsed, startedAt, diagnostics);
      }

      const allOk = [...executed.tasks.values()].every((t) => t.status === 'completed');
      const status: AgentRunResult['status'] = allOk ? 'completed' : 'failed';
      const answer = await this.synthesizeAnswer(executed, goal);

      await persist({
        status,
        completedStepsJson: JSON.stringify([...executed.tasks.keys()]),
        toolResultsJson: this.serializeResults(executed),
        errorsJson: JSON.stringify(errors),
        currentStep: executed.tasks.size,
      });

      this.logRun(taskId, status, executed.tasks.size, toolCalls, webSearches, errors.length, Date.now() - startedAt, toolNamesUsed);
      return this.result(taskId, status, answer, executed.tasks.size, toolCalls, webSearches, errors, toolNamesUsed, startedAt, diagnostics);
    } catch (err: any) {
      const msg = err?.message ?? 'unexpected error';
      await persist({ status: 'failed', errorsJson: JSON.stringify([msg]) });
      this.logRun(taskId, 'failed', 0, 0, webSearches, 1, Date.now() - startedAt, toolNamesUsed);
      return this.result(taskId, 'failed', 'Something went wrong.', 0, 0, webSearches, [msg], toolNamesUsed, startedAt);
    }
  }

  /**
   * Runs the agent workflow, streaming all internal execution events as an async iterable.
   */
  public async *runStream(
    userId: string,
    goal: string,
    context?: {
      guildId?: string | null;
      channelId?: string | null;
      checkpoint?: ExecutionCheckpoint;
      executionId?: string;
      plan?: ExecutionPlan;
    }
  ): AsyncIterableIterator<ExecutionEvent> {
    const queue: ExecutionEvent[] = [];
    let resolveNext: (() => void) | null = null;
    let isDone = false;

    const push = (evt: ExecutionEvent) => {
      queue.push(evt);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    };

    const runPromise = this.run(userId, goal, {
      ...context,
      onProgress: push,
    }).finally(() => {
      isDone = true;
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    });

    while (!isDone || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else if (!isDone) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
      }
    }

    await runPromise;
  }

  private async withOverallTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`overall timeout ${this.limits.overallTimeoutMs}ms`)),
            this.limits.overallTimeoutMs
          );
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private serializeResults(plan: ExecutionPlan): string {
    try {
      const data = [...plan.tasks.values()].map((t) => ({ id: t.id, toolSlug: t.toolSlug, result: t.result }));
      return truncate(JSON.stringify(data), this.limits.maxResultBytes);
    } catch { return null as any; }
  }

  /**
   * Synthesizes a coherent final answer. Attempts AI-powered synthesis first,
   * falling back cleanly to structured string formatting.
   */
  private async synthesizeAnswer(plan: ExecutionPlan, goal: string): Promise<string> {
    const completed = [...plan.tasks.values()].filter((t) => t.status === 'completed' && t.result !== undefined);
    if (completed.length === 0) {
      const failed = [...plan.tasks.values()].filter((t) => t.status === 'failed');
      if (failed.length > 0) return `I wasn't able to fully complete: "${goal}". I gathered some information but hit errors on ${failed.length} step(s).`;
      return `I planned ${plan.tasks.size} steps for "${goal}" but wasn't able to complete them within the current limits.`;
    }

    try {
      const evidence = completed.map((t) => {
        const rendered = typeof t.result === 'string' ? t.result : safeStringify(t.result);
        return `Task [${t.name}]: ${truncate(rendered, Math.floor(this.limits.maxResultBytes / completed.length))}`;
      }).join('\n\n');

      const synthesisPrompt = `You are a helpful assistant. The user requested: "${goal}".
Here are the completed steps and their results:
${evidence}

Provide a concise, direct, helpful final answer that addresses the user's goal based on this evidence. Do not output raw JSON or task IDs.`;

      const aiResponse = await this.aiService.generate({
        prompt: synthesisPrompt,
        maxTokens: 1000,
      });

      if (aiResponse && aiResponse.trim().length > 0) {
        return aiResponse.trim();
      }
    } catch (err: any) {
      logger.warn(`AI synthesis failed, falling back to deterministic formatting: ${err?.message}`);
    }

    return this.synthesize(plan, goal);
  }

  public synthesize(plan: ExecutionPlan, goal: string): string {
    const completed = [...plan.tasks.values()].filter((t) => t.status === 'completed' && t.result !== undefined);
    if (completed.length === 0) {
      const failed = [...plan.tasks.values()].filter((t) => t.status === 'failed');
      if (failed.length > 0) return `I wasn't able to fully complete: "${goal}". I gathered some information but hit errors on ${failed.length} step(s).`;
      return `I planned ${plan.tasks.size} steps for "${goal}" but wasn't able to complete them within the current limits.`;
    }
    const parts = completed.map((t, i) => {
      const rendered = typeof t.result === 'string' ? t.result : safeStringify(t.result);
      return `${i + 1}. ${t.name}: ${truncate(rendered, this.limits.maxResultBytes)}`;
    });
    return `Here's what I found for "${goal}":\n\n${parts.join('\n')}`;
  }

  private result(
    taskId: string, status: AgentRunResult['status'], answer: string, stepsExecuted: number,
    toolCalls: number, webSearches: number, errors: string[], toolNamesUsed: string[], startedAt: number,
    diagnostics?: ExecutionDiagnostics,
  ): AgentRunResult {
    return {
      taskId,
      status,
      answer,
      stepsExecuted,
      toolCalls,
      webSearches,
      errors,
      toolNamesUsed,
      durationMs: Date.now() - startedAt,
      traceId: diagnostics?.traceId,
      telemetry: diagnostics,
    };
  }

  private logRun(taskId: string, status: string, steps: number, toolCalls: number, webSearches: number, errorCount: number, durationMs: number, tools: string[]) {
    logger.info(`[task=${taskId}] status=${status} steps=${steps} toolCalls=${toolCalls} webSearches=${webSearches} errors=${errorCount} durationMs=${durationMs} tools=[${[...new Set(tools)].join(',')}]`);
  }
}

function safeStringify(v: any): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}
