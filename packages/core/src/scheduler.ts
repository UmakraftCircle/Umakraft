import { ExecutionPlan, AgentTask, createLogger } from '@ai-agent-platform/shared';
import { TaskExecutor, DefaultTaskExecutor } from './task-executor.js';
import { ToolRegistry } from './tool-registry.js';
import { ContextLayer } from './layers/context-layer.js';
import { ContextLoader, ContextLoaderOptions } from './context-loader.js';
import {
  ExecutionState,
  ExecutionContext,
  ResolvedFile,
  ExecutionEvent,
  ExecutionEventType,
  ExecutionEventListener,
  ExecutionProgress,
  LayerResult,
  LayerStartedEvent,
  LayerCompletedEvent,
  TaskCompletedEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
} from './execution-state.js';
import { TaskManager } from './task-manager.js';
import {
  ExecutionCheckpoint,
  CheckpointStore,
  InMemoryCheckpointStore,
  defaultCheckpointStore,
  classifyFailure,
  ClassifiedFailure,
  FailureType,
  FailureRecoveryAction,
} from './checkpoint.js';
import {
  TelemetryEngine,
  ExecutionDiagnostics,
  createTelemetryEngine,
} from './telemetry.js';

export { ExecutionState, ExecutionContext };
export { TelemetryEngine, createTelemetryEngine };
export type { ExecutionDiagnostics };
export type {
  ResolvedFile,
  ContextLoaderOptions,
  ExecutionEvent,
  ExecutionEventType,
  ExecutionEventListener,
  ExecutionProgress,
  LayerResult,
  LayerStartedEvent,
  LayerCompletedEvent,
  TaskCompletedEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
};
export * from './checkpoint.js';
export { ContextLoader };
export { ContextLayer };
export type { TaskState } from './task-manager.js';

const logger = createLogger('DagScheduler');

export interface SchedulerOptions {
  maxConcurrency?: number;
  executor?: TaskExecutor;
  contextLayer?: ContextLayer;
  contextLoader?: ContextLoader;
  taskManager?: TaskManager;
  onEvent?: ExecutionEventListener;
  checkpointStore?: CheckpointStore;
  checkpoint?: ExecutionCheckpoint;
  autoCheckpoint?: boolean;
  telemetryEngine?: TelemetryEngine;
}

/**
 * Helper to run items with bounded concurrency.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

/**
 * DagScheduler — Progressive Layer Execution Engine
 *
 * Emits progress events and partial results after each completed layer.
 * The layer is the streaming boundary; internal function calls do not stream.
 *
 * Flow:
 * Plan -> Layer 1 Complete -> Emit Progress -> Layer 2 Complete -> Emit Partial Result -> Final Response
 */
export class DagScheduler {
  private executor: TaskExecutor;
  private registry?: ToolRegistry;
  private maxConcurrency: number;
  private contextLayer: ContextLayer;
  private taskManagerOverride?: TaskManager;
  private executionState?: ExecutionState;
  private eventListeners: Set<ExecutionEventListener> = new Set();
  private checkpointStore?: CheckpointStore;
  private initialCheckpoint?: ExecutionCheckpoint;
  private autoCheckpoint: boolean;
  private telemetryEngine?: TelemetryEngine;

  constructor(
    executorOrRegistry?: TaskExecutor | ToolRegistry,
    options: SchedulerOptions = {}
  ) {
    if (executorOrRegistry && 'executeTask' in executorOrRegistry) {
      this.executor = executorOrRegistry;
    } else if (executorOrRegistry && 'execute' in executorOrRegistry) {
      this.registry = executorOrRegistry as ToolRegistry;
      this.executor = new DefaultTaskExecutor(this.registry);
    } else if (options.executor) {
      this.executor = options.executor;
    } else {
      this.executor = new DefaultTaskExecutor();
    }
    this.maxConcurrency = options.maxConcurrency ?? 16;
    this.contextLayer = options.contextLayer ?? new ContextLayer(options.contextLoader);
    this.taskManagerOverride = options.taskManager;
    this.checkpointStore = options.checkpointStore ?? new InMemoryCheckpointStore();
    this.initialCheckpoint = options.checkpoint;
    this.autoCheckpoint = options.autoCheckpoint ?? true;
    this.telemetryEngine = options.telemetryEngine;
    if (options.onEvent) {
      this.eventListeners.add(options.onEvent);
    }
  }

  /**
   * Returns the TelemetryEngine instance associated with this scheduler.
   */
  public getTelemetryEngine(): TelemetryEngine | undefined {
    return this.telemetryEngine;
  }

  /**
   * Returns the execution diagnostics summary.
   */
  public getDiagnostics(): ExecutionDiagnostics | undefined {
    return this.telemetryEngine?.getDiagnostics() ?? this.executionState?.getTelemetry();
  }

  /**
   * Returns the checkpoint store used by the scheduler.
   */
  public getCheckpointStore(): CheckpointStore | undefined {
    return this.checkpointStore;
  }

  /**
   * Configures a custom checkpoint store.
   */
  public setCheckpointStore(store: CheckpointStore): void {
    this.checkpointStore = store;
  }

  /**
   * Subscribes a listener to execution events. Returns an unsubscribe function.
   */
  public onEvent(listener: ExecutionEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * Unsubscribes a listener from execution events.
   */
  public removeEventListener(listener: ExecutionEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emits an internal execution event to all registered listeners.
   */
  protected async emit(event: ExecutionEvent): Promise<void> {
    for (const listener of this.eventListeners) {
      try {
        await listener(event);
      } catch (err: any) {
        logger.warn(`ExecutionEventListener error: ${err?.message}`);
      }
    }
  }

  /**
   * Returns the persistent ExecutionState from the most recent run, if any.
   */
  public getExecutionState(): ExecutionState | undefined {
    return this.executionState;
  }

  /**
   * Streams execution events as an async iterable while executing the plan.
   */
  public async *scheduleStream(
    plan: ExecutionPlan,
    initialState?: ExecutionState,
    options?: { checkpoint?: ExecutionCheckpoint }
  ): AsyncIterableIterator<ExecutionEvent> {
    const queue: ExecutionEvent[] = [];
    let resolveNext: (() => void) | null = null;
    let isDone = false;

    const pushEvent = (evt: ExecutionEvent) => {
      queue.push(evt);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    };

    const unsubscribe = this.onEvent(pushEvent);

    const execPromise = this.schedule(plan, initialState, options).finally(() => {
      isDone = true;
      unsubscribe();
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

    await execPromise;
  }

  /**
   * Schedules and executes a plan's tasks following dependency graph layers.
   * Delegates dependency resolution and status authority completely to TaskManager.
   * Emits progress events and partial results layer by layer.
   * Supports checkpoint saving and resumable execution from the last completed layer.
   */
  public async schedule(
    plan: ExecutionPlan,
    initialState?: ExecutionState,
    options?: { checkpoint?: ExecutionCheckpoint }
  ): Promise<ExecutionPlan> {
    const planStartTime = Date.now();
    logger.info(`Starting DAG scheduling for plan: ${plan.id} (${plan.tasks.size} tasks)`);

    const telemetry = this.telemetryEngine ?? createTelemetryEngine(plan.id);
    this.telemetryEngine = telemetry;
    telemetry.startExecution(plan.id, { planId: plan.id, request: plan.intent });

    // ── Step 0: Checkpoint Discovery & Restoration ──
    const checkpoint =
      options?.checkpoint ??
      initialState?.checkpoint ??
      this.initialCheckpoint ??
      (this.checkpointStore ? await this.checkpointStore.loadCheckpoint(plan.id) : null);

    if (checkpoint) {
      logger.info(
        `Resuming execution for plan ${plan.id} from checkpoint at layer ${checkpoint.currentLayer} (${checkpoint.completedTasks.length} tasks pre-completed)`
      );
    }

    // ── Step 1: Register tasks with TaskManager (authority for task state) ──
    const taskManager = this.taskManagerOverride ?? new TaskManager(this.registry, this.executor);
    taskManager.loadPlan(plan, checkpoint ?? undefined);

    // ── Step 2: Pre-execution Circular Dependency Detection ──
    const cycleParticipants = taskManager.detectCircularDependencies();
    if (cycleParticipants && cycleParticipants.length > 0) {
      const errMsg = `Plan contains a circular dependency cycle involving tasks: ${cycleParticipants.join(', ')}`;
      logger.error(errMsg);
      classifyFailure(errMsg, { layerIndex: 0 });
      telemetry.recordFailure(errMsg, { layerIndex: 0 });
      telemetry.endExecution(false, Date.now() - planStartTime);
      this.executionState?.setTelemetry(telemetry.getDiagnostics());
      await this.emit({
        type: 'execution.failed',
        timestamp: new Date().toISOString(),
        planId: plan.id,
        error: errMsg,
      });
      return plan;
    }

    // ── Step 3: Initialize persistent ExecutionState ──
    this.executionState =
      initialState ?? new ExecutionState(plan, plan.intent, plan.metadata, plan.tasks);

    if (checkpoint) {
      this.executionState.restoreCheckpoint(checkpoint);
    }

    // Sync pre-completed tasks into execution state
    for (const task of taskManager.getAllTasks()) {
      if (task.status === 'completed' && task.result !== undefined) {
        this.executionState.recordTaskCompletion(task.id, task.result);
      }
    }

    // ── Step 4: Emit execution.started ──
    await this.emit({
      type: 'execution.started',
      timestamp: new Date().toISOString(),
      planId: plan.id,
      totalTasks: plan.tasks.size,
      request: plan.intent,
      metadata: {
        ...(plan.metadata ?? {}),
        resumedFromCheckpoint: !!checkpoint,
        checkpointLayer: checkpoint?.currentLayer,
      },
    });

    if (plan.tasks.size === 0) {
      telemetry.endExecution(true, Date.now() - planStartTime);
      this.executionState?.setTelemetry(telemetry.getDiagnostics());
      await this.emit({
        type: 'execution.completed',
        timestamp: new Date().toISOString(),
        planId: plan.id,
        totalTasks: 0,
        completedTasks: [],
        outputs: {},
        durationMs: Date.now() - planStartTime,
      });
      return plan;
    }

    // Calculate total layers
    const allTasks = taskManager.getAllTasks();
    const maxLayer = allTasks.reduce((max, t) => Math.max(max, (t as any).layer ?? 0), 0);
    const totalLayers = maxLayer + 1;
    this.executionState.updateProgress(checkpoint?.currentLayer ?? 0, totalLayers);

    let hasFailed = false;

    // ── Step 5: Layer-by-layer progressive execution ──
    while (taskManager.hasPendingTasks() && !hasFailed) {
      const readyByLayer = taskManager.getReadyTasksByLayer();

      // Deadlock check: pending tasks exist, but none are ready
      if (readyByLayer.size === 0) {
        const pending = taskManager
          .getAllTasks()
          .filter((t) => t.status === 'pending')
          .map(
            (t) =>
              `${t.id}(deps:[${(t.dependencies ?? []).filter((d) => !taskManager.isCompleted(d)).join(', ')}])`
          );
        const deadlockMsg = `Deadlock detected! Unresolved tasks: ${pending.join(', ')}`;
        logger.error(deadlockMsg);
        classifyFailure(deadlockMsg);
        telemetry.recordFailure(deadlockMsg);
        hasFailed = true;
        await this.emit({
          type: 'execution.failed',
          timestamp: new Date().toISOString(),
          planId: plan.id,
          error: deadlockMsg,
        });
        break;
      }

      // Select the current execution layer
      const currentLayerIndex = Array.from(readyByLayer.keys())[0];
      const tasksInLayer = readyByLayer.get(currentLayerIndex)!;

      this.executionState.currentLayer = currentLayerIndex;
      this.executionState.updateProgress(currentLayerIndex, totalLayers);
      const layerStartTime = Date.now();
      const layerTaskIds = tasksInLayer.map((t) => t.id);
      telemetry.recordLayerStart(currentLayerIndex, layerTaskIds);

      // Emit layer.started
      await this.emit({
        type: 'layer.started',
        timestamp: new Date().toISOString(),
        layerIndex: currentLayerIndex,
        totalLayers,
        taskIds: layerTaskIds,
      });

      const layerOutputs: Record<string, any> = {};
      const completedInLayer: string[] = [];
      let layerFailed = false;
      let layerFailedTask: AgentTask | null = null;
      let layerError = '';

      // Execute all tasks in this layer concurrently up to maxConcurrency
      await runWithConcurrency(tasksInLayer, this.maxConcurrency, async (task) => {
        if (layerFailed) return;

        const taskStartTime = Date.now();
        telemetry.recordTaskStart(task.id, task.toolSlug);
        taskManager.markRunning(task.id);
        const context = await this.contextLayer.createScopedContext(task, this.executionState);

        const contextFilesBytes = Array.from(context.files.values()).reduce((acc, f) => acc + (f.size || 0), 0);
        telemetry.recordContextSize(context.files.size, contextFilesBytes, context.memories.length);
        if (context.model) {
          const modelId = typeof context.model === 'string' ? context.model : ((context.model as any).modelId ?? 'default');
          telemetry.recordModelUsage(modelId);
        }

        try {
          const preValidation = this.contextLayer.validateContextTask(context);
          if (!preValidation.valid) {
            logger.warn(
              `Task [${task.id}] prerequisite validation warning: ${preValidation.errors.join('; ')}`
            );
          }

          let result = await this.executor.executeTask(task);

          // If execution failed, classify failure and retry current task if applicable
          if (!result.success) {
            const failure = classifyFailure(result.error ?? 'Execution failed', {
              taskId: task.id,
              layerIndex: currentLayerIndex,
            });

            if (failure.recovery === 'retry_task') {
              const maxRetries = task.maxRetries ?? 2;
              while (!result.success && (task.retryCount ?? 0) < maxRetries) {
                task.retryCount = (task.retryCount ?? 0) + 1;
                logger.info(
                  `Retrying task [${task.id}] (attempt ${task.retryCount}/${maxRetries}) after ${failure.type}`
                );
                result = await this.executor.executeTask(task);
              }
            }
          }

          const durationMs = Date.now() - taskStartTime;

          if (result.success) {
            taskManager.markCompleted(task.id, result.data);
            this.executionState?.recordTaskCompletion(task.id, result.data);
            completedInLayer.push(task.id);
            layerOutputs[task.id] = result.data;
            telemetry.recordTaskEnd(task.id, durationMs, true, undefined, task.toolSlug, currentLayerIndex);
            telemetry.recordToolUsage(task.toolSlug, durationMs, true);

            await this.emit({
              type: 'task.completed',
              timestamp: new Date().toISOString(),
              taskId: task.id,
              taskName: task.name,
              layerIndex: currentLayerIndex,
              success: true,
              result: result.data,
              durationMs,
            });
          } else {
            const err = result.error ?? 'Execution failed';
            taskManager.markFailed(task.id, err);
            this.executionState?.recordTaskFailure(task.id, err);
            layerFailed = true;
            layerFailedTask = task;
            layerError = err;
            telemetry.recordTaskEnd(task.id, durationMs, false, err, task.toolSlug, currentLayerIndex);
            telemetry.recordToolUsage(task.toolSlug, durationMs, false);

            await this.emit({
              type: 'task.completed',
              timestamp: new Date().toISOString(),
              taskId: task.id,
              taskName: task.name,
              layerIndex: currentLayerIndex,
              success: false,
              error: err,
              durationMs,
            });
          }
        } catch (err: any) {
          const errorMsg = err?.message ?? 'Unexpected error';
          logger.error(`Unhandled error in task [${task.id}]: ${errorMsg}`);
          const failure = classifyFailure(errorMsg, {
            taskId: task.id,
            layerIndex: currentLayerIndex,
          });

          let recovered = false;
          if (failure.recovery === 'retry_task') {
            const maxRetries = task.maxRetries ?? 2;
            while (!recovered && (task.retryCount ?? 0) < maxRetries) {
              task.retryCount = (task.retryCount ?? 0) + 1;
              logger.info(
                `Retrying task [${task.id}] (attempt ${task.retryCount}/${maxRetries}) after error: ${failure.type}`
              );
              try {
                const retryResult = await this.executor.executeTask(task);
                if (retryResult.success) {
                  recovered = true;
                  taskManager.markCompleted(task.id, retryResult.data);
                  this.executionState?.recordTaskCompletion(task.id, retryResult.data);
                  completedInLayer.push(task.id);
                  layerOutputs[task.id] = retryResult.data;
                  telemetry.recordTaskEnd(task.id, Date.now() - taskStartTime, true, undefined, task.toolSlug, currentLayerIndex);
                  telemetry.recordToolUsage(task.toolSlug, Date.now() - taskStartTime, true);

                  await this.emit({
                    type: 'task.completed',
                    timestamp: new Date().toISOString(),
                    taskId: task.id,
                    taskName: task.name,
                    layerIndex: currentLayerIndex,
                    success: true,
                    result: retryResult.data,
                    durationMs: Date.now() - taskStartTime,
                  });
                  break;
                }
              } catch {
                // Continue retry loop
              }
            }
          }

          if (!recovered) {
            taskManager.markFailed(task.id, `Unexpected runtime error: ${errorMsg}`);
            this.executionState?.recordTaskFailure(task.id, errorMsg);
            layerFailed = true;
            layerFailedTask = task;
            layerError = errorMsg;
            telemetry.recordTaskEnd(task.id, Date.now() - taskStartTime, false, errorMsg, task.toolSlug, currentLayerIndex);
            telemetry.recordToolUsage(task.toolSlug, Date.now() - taskStartTime, false);

            await this.emit({
              type: 'task.completed',
              timestamp: new Date().toISOString(),
              taskId: task.id,
              taskName: task.name,
              layerIndex: currentLayerIndex,
              success: false,
              error: errorMsg,
              durationMs: Date.now() - taskStartTime,
            });
          }
        } finally {
          this.contextLayer.disposeContext(context);
        }
      });

      const layerDuration = Date.now() - layerStartTime;
      telemetry.recordLayerEnd(currentLayerIndex, layerDuration, !layerFailed, layerError || undefined);

      if (layerFailed) {
        hasFailed = true;
        telemetry.recordFailure(layerError, { layerIndex: currentLayerIndex, taskId: layerFailedTask?.id });
        // Do NOT save checkpoint for failed layer (ensures consistency)
        const partialResult: LayerResult = {
          completedTasks: completedInLayer,
          outputs: layerOutputs,
          duration: layerDuration,
          nextLayer: undefined,
        };
        this.executionState.updateProgress(currentLayerIndex, totalLayers);
        await this.emit({
          type: 'layer.completed',
          timestamp: new Date().toISOString(),
          layerIndex: currentLayerIndex,
          totalLayers,
          layerResult: partialResult,
          progress: this.executionState.progress,
        });

        await this.emit({
          type: 'execution.failed',
          timestamp: new Date().toISOString(),
          planId: plan.id,
          error: layerError,
          layerIndex: currentLayerIndex,
          failedTaskId: layerFailedTask?.id,
        });
        break;
      }

      // ── Step 2 in runtime lifecycle: Validate ──
      // All tasks in this layer succeeded!

      // ── Step 3 in runtime lifecycle: Save Checkpoint ──
      // Checkpoint is persisted atomically ONLY after successful layer completion
      let layerCheckpoint: ExecutionCheckpoint | undefined;
      if (this.autoCheckpoint) {
        layerCheckpoint = {
          executionId: plan.id,
          completedTasks: Array.from(this.executionState.completedTasks),
          outputs: Object.fromEntries(this.executionState.outputs.entries()),
          currentLayer: currentLayerIndex,
          timestamp: new Date().toISOString(),
          metadata: {
            planId: plan.id,
            layerIndex: currentLayerIndex,
            totalLayers,
          },
        };
        this.executionState.checkpoint = layerCheckpoint;
        if (this.checkpointStore) {
          await this.checkpointStore.saveCheckpoint(layerCheckpoint);
        }
      }

      // ── Step 4 in runtime lifecycle: Emit Progress ──
      const hasMoreTasks = taskManager.hasPendingTasks();
      const nextLayer = hasMoreTasks ? currentLayerIndex + 1 : undefined;

      const layerResult: LayerResult = {
        completedTasks: completedInLayer,
        outputs: layerOutputs,
        duration: layerDuration,
        nextLayer,
      };

      this.executionState.updateProgress(currentLayerIndex, totalLayers);

      await this.emit({
        type: 'layer.completed',
        timestamp: new Date().toISOString(),
        layerIndex: currentLayerIndex,
        totalLayers,
        layerResult,
        progress: this.executionState.progress,
        checkpoint: layerCheckpoint,
      });
    }

    if (!hasFailed) {
      logger.info(`Plan execution succeeded for plan ${plan.id}!`);
      await this.emit({
        type: 'execution.completed',
        timestamp: new Date().toISOString(),
        planId: plan.id,
        totalTasks: plan.tasks.size,
        completedTasks: Array.from(this.executionState.completedTasks),
        outputs: Object.fromEntries(this.executionState.outputs.entries()),
        durationMs: Date.now() - planStartTime,
      });
    } else {
      logger.error(`Plan execution failed for plan ${plan.id}`);
    }

    // Synchronize authoritative states from TaskManager back to plan.tasks
    for (const task of taskManager.getAllTasks()) {
      const planTask = plan.tasks.get(task.id);
      if (planTask) {
        planTask.status = task.status;
        planTask.result = task.result;
        planTask.error = task.error;
        planTask.retryCount = task.retryCount;
        (planTask as any).layer = (task as any).layer;
        (planTask as any).dependsOn = (task as any).dependsOn;
      }
    }

    // Record execution completion in Telemetry
    telemetry.endExecution(!hasFailed, Date.now() - planStartTime);
    const diagnostics = telemetry.getDiagnostics();
    this.executionState.setTelemetry(diagnostics);

    return plan;
  }
}
