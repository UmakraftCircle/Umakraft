import type { ExecutionPlan, AgentTask, ToolDefinition } from '@ai-agent-platform/shared';
import type { FailureObservation } from './learning.js';
import type { RoutingDecision } from './model-router.js';
import type { ExecutionCheckpoint } from './checkpoint.js';
import type { ExecutionDiagnostics } from './telemetry.js';

/**
 * Resolved file loaded selectively for a specific task.
 */
export interface ResolvedFile {
  path: string;
  relativePath: string;
  content?: string;
  size: number;
  priority: 1 | 2 | 3 | 4; // 1 = target, 2 = imported, 3 = shared types, 4 = config
  category: 'target' | 'dependency' | 'types' | 'config';
}

/**
 * Memory classification type.
 */
export type MemoryType = 'session' | 'semantic' | 'profile' | 'working';

/**
 * Retrieved memory item injected into ExecutionContext by ContextLoader.
 */
export interface RetrievedMemory {
  id: string;
  type: MemoryType;
  content: string | Record<string, any>;
  score?: number;
  metadata?: Record<string, any>;
  rankingFactors?: {
    relevance: number;
    recency: number;
    priority: number;
    exactMatch: boolean;
  };
  // Compatibility fields with FailureObservation
  taskId?: string;
  taskName?: string;
  toolSlug?: string;
  errorMessage?: string;
  timestamp?: string;
  context?: string;
}

/**
 * ExecutionContext (temporary)
 *
 * Exists for exactly one task. Holds only the minimal files, tools, memories,
 * and model configuration required by that task. It is completely destroyed
 * immediately after task execution and validation.
 */
export class ExecutionContext {
  public task: AgentTask;
  public files: Map<string, ResolvedFile> = new Map();
  public tools: Map<string, ToolDefinition> = new Map();
  public memories: Array<RetrievedMemory | FailureObservation> = [];
  public workingMemory?: any;
  public model?: RoutingDecision | { modelId: string; [key: string]: any };
  public promptContext?: string;
  public temporaryCache: Map<string, any> = new Map();
  private _disposed = false;

  constructor(task: AgentTask) {
    this.task = task;
  }

  public get isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Destroys all temporary resources allocated for this task.
   * Releases files, tool instances, memory results, working memory, prompt context, and temp caches.
   */
  public dispose(): void {
    if (this._disposed) return;
    this.files.clear();
    this.tools.clear();
    this.memories.length = 0;
    if (this.workingMemory && typeof this.workingMemory.destroy === 'function') {
      try {
        this.workingMemory.destroy();
      } catch {
        // Ignore errors if already destroyed
      }
    }
    this.workingMemory = undefined;
    this.model = undefined;
    this.promptContext = undefined;
    this.temporaryCache.clear();
    this._disposed = true;
  }
}

/**
 * Phase 8: Execution Events & Runtime Progress Model
 *
 * Represents internal runtime progress only (not user-facing messages).
 */
export type ExecutionEventType =
  | 'execution.started'
  | 'layer.started'
  | 'task.completed'
  | 'layer.completed'
  | 'execution.completed'
  | 'execution.failed';

export interface BaseExecutionEvent {
  type: ExecutionEventType;
  timestamp: string;
}

export interface ExecutionStartedEvent extends BaseExecutionEvent {
  type: 'execution.started';
  planId: string;
  totalTasks: number;
  request?: string;
  metadata?: Record<string, any>;
}

export interface LayerStartedEvent extends BaseExecutionEvent {
  type: 'layer.started';
  layerIndex: number;
  totalLayers: number;
  taskIds: string[];
}

export interface TaskCompletedEvent extends BaseExecutionEvent {
  type: 'task.completed';
  taskId: string;
  taskName: string;
  layerIndex: number;
  success: boolean;
  result?: any;
  error?: string;
  durationMs?: number;
}

export interface LayerResult {
  completedTasks: string[];
  outputs: Record<string, any>;
  duration: number;
  nextLayer?: number;
}

export interface LayerCompletedEvent extends BaseExecutionEvent {
  type: 'layer.completed';
  layerIndex: number;
  totalLayers: number;
  layerResult: LayerResult;
  progress: ExecutionProgress;
  checkpoint?: ExecutionCheckpoint;
}

export interface ExecutionCompletedEvent extends BaseExecutionEvent {
  type: 'execution.completed';
  planId: string;
  totalTasks: number;
  completedTasks: string[];
  outputs: Record<string, any>;
  durationMs: number;
}

export interface ExecutionFailedEvent extends BaseExecutionEvent {
  type: 'execution.failed';
  planId: string;
  error: string;
  layerIndex?: number;
  failedTaskId?: string;
}

export type ExecutionEvent =
  | ExecutionStartedEvent
  | LayerStartedEvent
  | TaskCompletedEvent
  | LayerCompletedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent;

export type ExecutionEventListener = (event: ExecutionEvent) => void | Promise<void>;

export interface ExecutionProgress {
  completed: number;
  total: number;
  percentage: number;
  currentLayer?: number;
  totalLayers?: number;
}

export type { ExecutionCheckpoint };

/**
 * ExecutionState (persistent)
 *
 * Survives for the entire request/plan until the final response is produced.
 * Tracks workflow progress: request, taskGraph, currentLayer, progress, outputs, and metadata.
 *
 * CRITICAL ARCHITECTURAL RULE:
 * Repository files and retrieved memory contents must NEVER be stored inside ExecutionState.
 * ExecutionState stores only task outputs, errors, completion statuses, progress, and plan metadata.
 */
export class ExecutionState {
  public readonly request: string;
  public readonly plan: ExecutionPlan;
  public readonly taskGraph: Map<string, AgentTask>;
  public readonly completedTasks: Set<string> = new Set();
  public readonly failedTasks: Set<string> = new Set();
  public readonly outputs: Map<string, any> = new Map();
  public readonly errors: Map<string, string> = new Map();
  public readonly metadata: Record<string, any>;
  public currentLayer: number = 0;
  public progress: ExecutionProgress;
  public checkpoint?: ExecutionCheckpoint;
  public telemetry?: ExecutionDiagnostics;

  constructor(
    planOrOptions?:
      | ExecutionPlan
      | {
          plan?: any;
          request?: string;
          metadata?: Record<string, any>;
          taskGraph?: any;
          tasks?: any;
          checkpoint?: ExecutionCheckpoint;
          telemetry?: ExecutionDiagnostics;
        },
    request?: string,
    metadata?: Record<string, any>,
    taskGraph?: Map<string, AgentTask>
  ) {
    let rawPlan: any;
    let rawRequest: string | undefined;
    let rawMetadata: Record<string, any> | undefined;
    let rawTaskGraph: any;
    let rawCheckpoint: ExecutionCheckpoint | undefined;
    let rawTelemetry: ExecutionDiagnostics | undefined;

    if (
      planOrOptions &&
      typeof planOrOptions === 'object' &&
      !('intent' in planOrOptions || ('tasks' in planOrOptions && 'id' in planOrOptions && !('plan' in planOrOptions)))
    ) {
      const opts = planOrOptions as any;
      rawPlan = opts.plan;
      rawRequest = opts.request;
      rawMetadata = opts.metadata;
      rawTaskGraph = opts.taskGraph ?? opts.tasks;
      rawCheckpoint = opts.checkpoint;
      rawTelemetry = opts.telemetry;
    } else {
      rawPlan = planOrOptions;
      rawRequest = request;
      rawMetadata = metadata;
      rawTaskGraph = taskGraph;
    }

    const planTasksMap = new Map<string, AgentTask>();
    if (rawPlan && rawPlan.tasks) {
      if (rawPlan.tasks instanceof Map) {
        for (const [k, v] of rawPlan.tasks.entries()) {
          planTasksMap.set(k, v);
        }
      } else if (Array.isArray(rawPlan.tasks)) {
        for (const t of rawPlan.tasks) {
          if (t && t.id) planTasksMap.set(t.id, t);
        }
      }
    }

    this.plan = rawPlan
      ? {
          id: rawPlan.id ?? 'plan-default',
          intent: rawPlan.intent ?? rawPlan.request ?? 'default',
          tasks: planTasksMap,
          metadata: rawPlan.metadata ?? {
            modelUsed: 'default',
            createdAt: new Date().toISOString(),
            estimatedSteps: planTasksMap.size,
          },
        }
      : {
          id: 'plan-default',
          intent: 'default',
          tasks: new Map(),
          metadata: {
            modelUsed: 'default',
            createdAt: new Date().toISOString(),
            estimatedSteps: 0,
          },
        };

    this.request = rawRequest ?? this.plan.intent;

    if (rawTaskGraph instanceof Map) {
      this.taskGraph = rawTaskGraph;
    } else if (Array.isArray(rawTaskGraph)) {
      this.taskGraph = new Map();
      for (const t of rawTaskGraph) {
        if (t && t.id) this.taskGraph.set(t.id, t);
      }
    } else {
      this.taskGraph = this.plan.tasks ?? new Map();
    }

    this.metadata = {
      ...(this.plan.metadata ?? {}),
      ...(rawMetadata ?? {}),
      startedAt: new Date().toISOString(),
    };

    // Pre-populate already completed/failed tasks if re-entering
    for (const task of this.taskGraph.values()) {
      if (task.status === 'completed') {
        this.completedTasks.add(task.id);
        if (task.result !== undefined) {
          this.outputs.set(task.id, task.result);
        }
      } else if (task.status === 'failed') {
        this.failedTasks.add(task.id);
        if (task.error) {
          this.errors.set(task.id, task.error);
        }
      }
    }

    this.currentLayer = 0;
    const total = this.taskGraph.size || (this.plan.tasks?.size ?? 0);
    const completed = this.completedTasks.size;
    this.progress = {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      currentLayer: 0,
      totalLayers: 0,
    };

    if (rawCheckpoint) {
      this.restoreCheckpoint(rawCheckpoint);
    }
    this.telemetry = rawTelemetry;
  }

  public updateProgress(currentLayer?: number, totalLayers?: number): ExecutionProgress {
    if (currentLayer !== undefined) {
      this.currentLayer = currentLayer;
    }
    const total = this.taskGraph.size || (this.plan.tasks?.size ?? 0);
    const completed = this.completedTasks.size;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.progress = {
      completed,
      total,
      percentage,
      currentLayer: this.currentLayer,
      totalLayers: totalLayers ?? this.progress?.totalLayers ?? 0,
    };
    return this.progress;
  }

  public recordTaskCompletion(taskId: string, output: any): void {
    this.completedTasks.add(taskId);
    this.failedTasks.delete(taskId);
    this.outputs.set(taskId, output);
    this.errors.delete(taskId);
    this.updateProgress();
  }

  public recordOutput(taskId: string, output: any): void {
    this.outputs.set(taskId, output);
  }

  public recordTaskFailure(taskId: string, error: string): void {
    this.failedTasks.add(taskId);
    this.errors.set(taskId, error);
    this.updateProgress();
  }

  public getOutput(taskId: string): any {
    return this.outputs.get(taskId);
  }

  public isCompleted(taskId: string): boolean {
    return this.completedTasks.has(taskId);
  }

  public hasFailed(taskId: string): boolean {
    return this.failedTasks.has(taskId) || this.errors.has(taskId);
  }

  public isDone(): boolean {
    const total = this.taskGraph.size || this.plan.tasks.size;
    const finished = this.completedTasks.size + this.failedTasks.size;
    return finished >= total;
  }

  public restoreCheckpoint(checkpoint: ExecutionCheckpoint): void {
    this.checkpoint = checkpoint;
    this.currentLayer = checkpoint.currentLayer;
    for (const taskId of checkpoint.completedTasks) {
      this.completedTasks.add(taskId);
      this.failedTasks.delete(taskId);
    }
    if (checkpoint.outputs) {
      for (const [taskId, output] of Object.entries(checkpoint.outputs)) {
        this.outputs.set(taskId, output);
      }
    }
    this.updateProgress(checkpoint.currentLayer);
  }

  public setCheckpoint(checkpoint: ExecutionCheckpoint): void {
    this.checkpoint = checkpoint;
  }

  public getCheckpoint(): ExecutionCheckpoint | undefined {
    return this.checkpoint;
  }

  public setTelemetry(telemetry: ExecutionDiagnostics): void {
    this.telemetry = telemetry;
  }

  public getTelemetry(): ExecutionDiagnostics | undefined {
    return this.telemetry;
  }

  public getSummary(): Record<string, any> {
    return {
      request: this.request,
      planId: this.plan.id,
      totalTasks: this.taskGraph.size,
      completedCount: this.completedTasks.size,
      failedCount: this.failedTasks.size,
      completedTasks: Array.from(this.completedTasks),
      failedTasks: Array.from(this.failedTasks),
      outputs: Object.fromEntries(this.outputs.entries()),
      errors: Object.fromEntries(this.errors.entries()),
      currentLayer: this.currentLayer,
      progress: this.progress,
      checkpoint: this.checkpoint,
      telemetry: this.telemetry,
      metadata: this.metadata,
    };
  }
}
