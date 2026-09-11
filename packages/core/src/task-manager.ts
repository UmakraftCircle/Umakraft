import { ExecutionPlan, AgentTask, TaskStatus, createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';
import { DagScheduler } from './scheduler.js';
import { DefaultTaskExecutor, TaskExecutor } from './task-executor.js';
import type { ExecutionCheckpoint } from './checkpoint.js';
import type { ExecutionDiagnostics, TelemetryEngine } from './telemetry.js';

export { DagScheduler } from './scheduler.js';
export type { TaskExecutor } from './task-executor.js';
export { DefaultTaskExecutor, isRetryableError } from './task-executor.js';

const logger = createLogger('TaskManager');

export type TaskState = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskGraphNode extends AgentTask {
  layer: number;
  dependsOn: string[];
}

/**
 * TaskManager
 *
 * Single authority for task state, graph dependency resolution, and lifecycle status.
 * Responsibilities:
 * - Register tasks and build dependency graphs
 * - Track task completion and state transitions
 * - Resolve ready tasks grouped by execution layer
 * - Detect circular dependencies and invalid dependencies
 * - Update task status (Pending -> Running -> Completed / Failed)
 *
 * NOTE: TaskManager does not directly execute tasks; it delegates execution
 * to the DagScheduler and TaskExecutor.
 */
export class TaskManager {
  private tasks: Map<string, AgentTask> = new Map();
  private completedTasks: Set<string> = new Set();
  private failedTasks: Set<string> = new Set();
  private runningTasks: Set<string> = new Set();
  private taskResults: Map<string, any> = new Map();
  private taskErrors: Map<string, string> = new Map();
  private scheduler?: DagScheduler;

  constructor(
    private registry: ToolRegistry = ToolRegistry.getInstance(),
    private executor?: TaskExecutor
  ) {}

  // ── Task Registration ──

  /**
   * Registers a single task into the graph.
   */
  public registerTask(task: AgentTask): void {
    const deps = task.dependencies ?? (task as any).dependsOn ?? [];
    task.dependencies = deps;
    task.status = task.status ?? 'pending';
    task.retryCount = task.retryCount ?? 0;
    (task as any).dependsOn = deps;
    if ((task as any).layer === undefined) {
      (task as any).layer = 0;
    }

    this.tasks.set(task.id, task);

    if (task.status === 'completed') {
      this.completedTasks.add(task.id);
      if (task.result !== undefined) {
        this.taskResults.set(task.id, task.result);
      }
    } else if (task.status === 'failed') {
      this.failedTasks.add(task.id);
      if (task.error) {
        this.taskErrors.set(task.id, task.error);
      }
    } else if (task.status === 'running') {
      this.runningTasks.add(task.id);
    }
  }

  /**
   * Registers an iterable collection of tasks and computes execution layers.
   */
  public registerTasks(tasks: Iterable<AgentTask>): void {
    for (const task of tasks) {
      this.registerTask(task);
    }
    this.computeLayers();
  }

  /**
   * Loads all tasks from an ExecutionPlan and optionally restores state from a checkpoint.
   */
  public loadPlan(plan: ExecutionPlan, checkpoint?: ExecutionCheckpoint): void {
    this.clear();
    this.registerTasks(plan.tasks.values());
    if (checkpoint) {
      this.restoreFromCheckpoint(checkpoint);
    }
  }

  /**
   * Restores task states from an execution checkpoint.
   * Marks restored tasks as completed, ignores completed tasks during scheduling,
   * preserves dependency validation, and resets uncompleted tasks to pending.
   */
  public restoreFromCheckpoint(checkpoint: ExecutionCheckpoint): void {
    const completedSet = new Set(checkpoint.completedTasks);
    for (const taskId of completedSet) {
      const task = this.tasks.get(taskId);
      const result = checkpoint.outputs ? checkpoint.outputs[taskId] : undefined;
      if (task) {
        task.status = 'completed';
        if (result !== undefined) {
          task.result = result;
        }
      }
      this.completedTasks.add(taskId);
      this.failedTasks.delete(taskId);
      this.runningTasks.delete(taskId);
      this.taskErrors.delete(taskId);
      if (result !== undefined) {
        this.taskResults.set(taskId, result);
      }
    }

    // Reset non-checkpointed tasks to pending so they resume cleanly
    for (const [taskId, task] of this.tasks.entries()) {
      if (!completedSet.has(taskId)) {
        task.status = 'pending';
        task.error = undefined;
        this.failedTasks.delete(taskId);
        this.runningTasks.delete(taskId);
        this.taskErrors.delete(taskId);
      }
    }
  }

  /**
   * Clears all registered tasks and tracking states.
   */
  public clear(): void {
    this.tasks.clear();
    this.completedTasks.clear();
    this.failedTasks.clear();
    this.runningTasks.clear();
    this.taskResults.clear();
    this.taskErrors.clear();
  }

  // ── Dependency Analysis & Circular Dependency Detection ──

  /**
   * Detects circular dependencies in the registered task graph using Kahn's algorithm.
   * Returns an array of task IDs involved in cycles, or null if the graph is a valid DAG.
   */
  public detectCircularDependencies(): string[] | null {
    if (this.tasks.size === 0) return null;

    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const id of this.tasks.keys()) {
      inDegree.set(id, 0);
      dependents.set(id, []);
    }

    for (const [id, task] of this.tasks.entries()) {
      const deps = (task.dependencies ?? (task as any).dependsOn ?? []).filter(depId =>
        this.tasks.has(depId)
      );
      inDegree.set(id, deps.length);

      for (const depId of deps) {
        dependents.get(depId)!.push(id);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    let visitedCount = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visitedCount++;

      for (const next of dependents.get(current) || []) {
        const newDegree = inDegree.get(next)! - 1;
        inDegree.set(next, newDegree);
        if (newDegree === 0) {
          queue.push(next);
        }
      }
    }

    if (visitedCount < this.tasks.size) {
      // Cycle participants are tasks whose in-degree remained > 0
      const cycleTasks = Array.from(inDegree.entries())
        .filter(([_, degree]) => degree > 0)
        .map(([id]) => id);
      return cycleTasks.length > 0 ? cycleTasks : null;
    }

    return null;
  }

  /**
   * Computes topological execution layers for all registered tasks.
   */
  private computeLayers(): void {
    const layerMap = new Map<string, number>();
    const visiting = new Set<string>();

    const resolveLayer = (id: string): number => {
      if (layerMap.has(id)) return layerMap.get(id)!;
      if (visiting.has(id)) return 0; // Avoid infinite loops on cycles
      visiting.add(id);

      const task = this.tasks.get(id);
      const deps = (task?.dependencies ?? (task as any)?.dependsOn ?? []).filter(depId =>
        this.tasks.has(depId)
      );
      if (deps.length === 0) {
        layerMap.set(id, 0);
        visiting.delete(id);
        return 0;
      }

      let maxDep = -1;
      for (const depId of deps) {
        maxDep = Math.max(maxDep, resolveLayer(depId));
      }

      const layer = maxDep + 1;
      layerMap.set(id, layer);
      visiting.delete(id);
      return layer;
    };

    for (const task of this.tasks.values()) {
      const layer = resolveLayer(task.id);
      (task as any).layer = layer;
      (task as any).dependsOn = task.dependencies ?? [];
    }
  }

  // ── Ready Task Resolution ──

  /**
   * Resolves tasks that are pending and whose dependencies are completely satisfied.
   */
  public getReadyTasks(): AgentTask[] {
    const ready: AgentTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        const deps = task.dependencies ?? (task as any).dependsOn ?? [];
        const allDepsMet = deps.every(depId => this.completedTasks.has(depId));
        if (allDepsMet) {
          ready.push(task);
        }
      }
    }
    return ready;
  }

  /**
   * Groups all currently ready tasks by their execution layer, sorted ascending.
   */
  public getReadyTasksByLayer(): Map<number, AgentTask[]> {
    const readyTasks = this.getReadyTasks();
    const grouped = new Map<number, AgentTask[]>();

    for (const task of readyTasks) {
      const layer = (task as any).layer ?? 0;
      if (!grouped.has(layer)) {
        grouped.set(layer, []);
      }
      grouped.get(layer)!.push(task);
    }

    // Return layers sorted ascending
    const sorted = new Map<number, AgentTask[]>();
    const layerNumbers = Array.from(grouped.keys()).sort((a, b) => a - b);
    for (const l of layerNumbers) {
      sorted.set(l, grouped.get(l)!);
    }
    return sorted;
  }

  /**
   * Groups all registered tasks by their execution layer.
   */
  public getTasksByLayer(): Map<number, AgentTask[]> {
    const grouped = new Map<number, AgentTask[]>();
    for (const task of this.tasks.values()) {
      const layer = (task as any).layer ?? 0;
      if (!grouped.has(layer)) {
        grouped.set(layer, []);
      }
      grouped.get(layer)!.push(task);
    }
    return grouped;
  }

  // ── State Transitions & Authority ──

  /**
   * Transitions a task to 'running'.
   */
  public markRunning(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Cannot mark task [${taskId}] as running: task not registered`);
      return;
    }
    task.status = 'running';
    this.runningTasks.add(taskId);
  }

  /**
   * Transitions a task to 'completed' and records its output.
   */
  public markCompleted(taskId: string, result?: any): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Cannot mark task [${taskId}] as completed: task not registered`);
      return;
    }
    task.status = 'completed';
    task.result = result;
    this.runningTasks.delete(taskId);
    this.completedTasks.add(taskId);
    this.failedTasks.delete(taskId);
    if (result !== undefined) {
      this.taskResults.set(taskId, result);
    }
  }

  /**
   * Transitions a task to 'failed' and records the failure error.
   */
  public markFailed(taskId: string, error?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Cannot mark task [${taskId}] as failed: task not registered`);
      return;
    }
    task.status = 'failed';
    task.error = error;
    this.runningTasks.delete(taskId);
    this.failedTasks.add(taskId);
    if (error) {
      this.taskErrors.set(taskId, error);
    }
  }

  /**
   * Generic status updater following state flow.
   */
  public updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: any,
    error?: string
  ): void {
    if (status === 'running') {
      this.markRunning(taskId);
    } else if (status === 'completed') {
      this.markCompleted(taskId, result);
    } else if (status === 'failed') {
      this.markFailed(taskId, error);
    } else {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = status;
      }
    }
  }

  // ── Queries ──

  public getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  public getAllTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  public getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.tasks.get(taskId)?.status;
  }

  public getTaskResult(taskId: string): any {
    return this.taskResults.get(taskId);
  }

  public getTaskError(taskId: string): string | undefined {
    return this.taskErrors.get(taskId);
  }

  public isCompleted(taskId: string): boolean {
    return this.completedTasks.has(taskId);
  }

  public hasFailed(taskId: string): boolean {
    return this.failedTasks.has(taskId);
  }

  public isRunning(taskId: string): boolean {
    return this.runningTasks.has(taskId);
  }

  public isPending(taskId: string): boolean {
    return this.tasks.get(taskId)?.status === 'pending';
  }

  public hasPendingTasks(): boolean {
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') return true;
    }
    return false;
  }

  public isAllTerminal(): boolean {
    for (const task of this.tasks.values()) {
      if (task.status === 'pending' || task.status === 'running') return false;
    }
    return true;
  }

  public hasAnyFailed(): boolean {
    return this.failedTasks.size > 0;
  }

  public getCompletedCount(): number {
    return this.completedTasks.size;
  }

  public getFailedCount(): number {
    return this.failedTasks.size;
  }

  // ── Orchestration Public API ──

  /**
   * Preserved public API: Orchestrates the execution of a multi-step Agent plan,
   * delegating graph execution to DagScheduler while TaskManager manages task state.
   */
  public async executePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
    if (!this.scheduler) {
      const taskExecutor = this.executor ?? new DefaultTaskExecutor(this.registry);
      this.scheduler = new DagScheduler(taskExecutor, { taskManager: this });
    }
    return this.scheduler.schedule(plan);
  }

  public getScheduler(): DagScheduler | undefined {
    return this.scheduler;
  }

  public getDiagnostics(): ExecutionDiagnostics | undefined {
    return this.scheduler?.getDiagnostics();
  }

  public getTelemetryEngine(): TelemetryEngine | undefined {
    return this.scheduler?.getTelemetryEngine();
  }
}
