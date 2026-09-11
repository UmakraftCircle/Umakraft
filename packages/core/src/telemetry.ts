import { createLogger, type LogCategory } from '@ai-agent-platform/shared';

const logger = createLogger('Telemetry');

/**
 * Phase 10: Execution Trace Span
 *
 * Append-only record of an individual execution event or unit of work.
 */
export interface ExecutionTraceEntry {
  executionId: string;
  layerId?: number | string;
  taskId?: string;
  timestamp: string;
  duration: number;
  status: 'success' | 'failed';
  type?: 'execution' | 'layer' | 'task' | 'tool' | 'model' | 'context';
  name?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionTrace {
  traceId: string;
  executionId: string;
  planId?: string;
  success?: boolean;
  totalDurationMs?: number;
  startTime: string;
  startedAt?: number;
  endTime?: string;
  endedAt?: number;
  metadata?: Record<string, any>;
  entries: ExecutionTraceEntry[];
  layers: Array<{ layerIndex: number; durationMs: number; success: boolean }>;
  failures: Array<{ error: string; layerIndex?: number; taskId?: string }>;
}

export interface ToolCallMetric {
  slug: string;
  calls: number;
  totalDurationMs: number;
  avgDurationMs: number;
  errors: number;
}

export interface ModelUsageMetric {
  modelId: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ExecutionMetrics {
  totalExecutionTimeMs: number;
  totalDurationMs: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  layerDurations: Record<number, number>;
  taskDurations: Record<string, number>;
  toolCalls: {
    total: number;
    byTool: Record<string, ToolCallMetric>;
  };
  toolUsage: Record<string, { count: number; totalDurationMs: number; errors: number }>;
  models: {
    totalRequests: number;
    selectedModels: string[];
    byModel: Record<string, ModelUsageMetric>;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  modelUsage: Record<string, { invocations: number; promptTokens: number; completionTokens: number; totalTokens: number }>;
  context: {
    loadedFilesCount: number;
    loadedFilesBytes: number;
    loadedMemoriesCount: number;
  };
  contextMetrics: {
    peakFilesLoaded: number;
    peakFileBytesLoaded: number;
    peakMemoriesRetrieved: number;
  };
}

export interface ExecutionDiagnostics {
  executionId: string;
  traceId: string;
  status: 'running' | 'success' | 'failed';
  totalDurationMs: number;
  slowestLayer?: {
    layerIndex: number;
    layerId: string | number;
    durationMs: number;
  };
  slowestTool?: {
    slug: string;
    durationMs: number;
    totalCalls: number;
  };
  selectedModel?: string;
  selectedModels: string[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  failureLocation?: {
    layerIndex?: number;
    taskId?: string;
    error: string;
  };
  contextSize: {
    filesCount: number;
    filesBytes: number;
    memoriesCount: number;
  };
  metrics: ExecutionMetrics;
  trace: ExecutionTrace;
  diagnostics: {
    slowestLayer?: { layerIndex: number; durationMs: number };
    slowestTool?: { slug: string; durationMs: number; totalCalls: number };
    peakFilesLoaded: number;
    peakFileBytesLoaded: number;
    peakMemoriesRetrieved: number;
  };
}

/**
 * Phase 10: TelemetryEngine
 *
 * Dedicated, independent telemetry service that records execution metrics,
 * tracks layer/task durations, tool usage, model selections, token consumption,
 * and builds append-only execution traces.
 *
 * CRITICAL ARCHITECTURAL RULE:
 * Telemetry observes every layer but NEVER controls execution or alters workflow decisions.
 */
export class TelemetryEngine {
  public readonly traceId: string;
  public executionId: string;
  private planId?: string;
  private metadata?: Record<string, any>;
  private startTime: number;
  private endTime?: number;
  private totalDurationMs?: number;
  private status: 'running' | 'success' | 'failed' = 'running';

  // Append-only execution trace
  private traceEntries: ExecutionTraceEntry[] = [];
  private layerHistory: Array<{ layerIndex: number; durationMs: number; success: boolean }> = [];
  private failureHistory: Array<{ error: string; layerIndex?: number; taskId?: string }> = [];

  // Task counters
  private tasksTotalCount: number = 0;
  private tasksCompletedCount: number = 0;
  private tasksFailedCount: number = 0;

  // Metrics storage
  private layerDurations: Map<number, number> = new Map();
  private taskDurations: Map<string, number> = new Map();
  private toolMetrics: Map<string, ToolCallMetric> = new Map();
  private modelMetrics: Map<string, ModelUsageMetric> = new Map();
  private promptTokens: number = 0;
  private completionTokens: number = 0;
  private loadedFilesCount: number = 0;
  private loadedFilesBytes: number = 0;
  private loadedMemoriesCount: number = 0;

  // Failure tracking
  private failureLocation?: {
    layerIndex?: number;
    taskId?: string;
    error: string;
  };

  // Active timers
  private layerStartTimes: Map<number, number> = new Map();
  private taskStartTimes: Map<string, number> = new Map();

  constructor(executionIdOrTraceId?: string, traceId?: string) {
    if (traceId) {
      this.executionId = executionIdOrTraceId ?? `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      this.traceId = traceId;
    } else if (executionIdOrTraceId?.startsWith('trace-')) {
      this.traceId = executionIdOrTraceId;
      this.executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    } else {
      this.executionId = executionIdOrTraceId ?? `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      this.traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    this.startTime = Date.now();
  }

  public getTraceId(): string {
    return this.traceId;
  }

  public getExecutionId(): string {
    return this.executionId;
  }

  public startExecution(executionId?: string, metadata?: Record<string, any>): string {
    if (executionId) {
      this.executionId = executionId;
      if (!this.planId) {
        this.planId = executionId;
      }
    }
    if (metadata?.planId) {
      this.planId = metadata.planId;
    }
    this.metadata = metadata;
    this.startTime = Date.now();
    this.status = 'running';

    this.addTraceEntry({
      executionId: this.executionId,
      timestamp: new Date().toISOString(),
      duration: 0,
      status: 'success',
      type: 'execution',
      name: 'execution.started',
      metadata,
    });

    return this.traceId;
  }

  public recordLayerStart(layerIndex: number, taskIds?: string[]): void {
    const now = Date.now();
    this.layerStartTimes.set(layerIndex, now);

    this.addTraceEntry({
      executionId: this.executionId,
      layerId: layerIndex,
      timestamp: new Date(now).toISOString(),
      duration: 0,
      status: 'success',
      type: 'layer',
      name: `layer.${layerIndex}.started`,
      metadata: { taskIds },
    });
  }

  public recordLayerEnd(
    layerIndex: number,
    durationMs?: number,
    success: boolean = true,
    error?: string
  ): void {
    const startTime = this.layerStartTimes.get(layerIndex);
    const duration = durationMs ?? (startTime ? Date.now() - startTime : 0);
    this.layerDurations.set(layerIndex, duration);
    this.layerHistory.push({ layerIndex, durationMs: duration, success });

    this.addTraceEntry({
      executionId: this.executionId,
      layerId: layerIndex,
      timestamp: new Date().toISOString(),
      duration,
      status: success ? 'success' : 'failed',
      type: 'layer',
      name: `layer.${layerIndex}.completed`,
      error,
    });
  }

  public recordTaskStart(taskId: string, toolSlug?: string): void {
    const now = Date.now();
    this.taskStartTimes.set(taskId, now);
    this.tasksTotalCount++;
  }

  public recordTaskEnd(
    taskId: string,
    durationMs?: number,
    success: boolean = true,
    error?: string,
    toolSlug?: string,
    layerIndex?: number
  ): void {
    const startTime = this.taskStartTimes.get(taskId);
    const duration = durationMs ?? (startTime ? Date.now() - startTime : 0);
    this.taskDurations.set(taskId, duration);

    if (success) {
      this.tasksCompletedCount++;
    } else {
      this.tasksFailedCount++;
    }

    this.addTraceEntry({
      executionId: this.executionId,
      layerId: layerIndex,
      taskId,
      timestamp: new Date().toISOString(),
      duration,
      status: success ? 'success' : 'failed',
      type: 'task',
      name: `task.${taskId}`,
      error,
      metadata: toolSlug ? { toolSlug } : undefined,
    });
  }

  public recordToolUsage(toolSlug: string, durationMs: number, success: boolean): void {
    const current = this.toolMetrics.get(toolSlug) ?? {
      slug: toolSlug,
      calls: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      errors: 0,
    };

    current.calls += 1;
    current.totalDurationMs += durationMs;
    current.avgDurationMs = Math.round(current.totalDurationMs / current.calls);
    if (!success) {
      current.errors += 1;
    }

    this.toolMetrics.set(toolSlug, current);

    this.addTraceEntry({
      executionId: this.executionId,
      timestamp: new Date().toISOString(),
      duration: durationMs,
      status: success ? 'success' : 'failed',
      type: 'tool',
      name: `tool.${toolSlug}`,
      metadata: { calls: current.calls },
    });
  }

  public recordModelUsage(
    modelId: string,
    tokens?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  ): void {
    const current = this.modelMetrics.get(modelId) ?? {
      modelId,
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    current.requests += 1;
    if (tokens) {
      const p = tokens.promptTokens ?? 0;
      const c = tokens.completionTokens ?? 0;
      const t = tokens.totalTokens ?? p + c;
      current.promptTokens += p;
      current.completionTokens += c;
      current.totalTokens += t;

      this.promptTokens += p;
      this.completionTokens += c;
    }

    this.modelMetrics.set(modelId, current);

    this.addTraceEntry({
      executionId: this.executionId,
      timestamp: new Date().toISOString(),
      duration: 0,
      status: 'success',
      type: 'model',
      name: `model.${modelId}`,
      metadata: { tokens },
    });
  }

  public recordContextSize(filesCount: number, filesBytes: number, memoriesCount: number): void {
    this.loadedFilesCount = Math.max(this.loadedFilesCount, filesCount);
    this.loadedFilesBytes = Math.max(this.loadedFilesBytes, filesBytes);
    this.loadedMemoriesCount = Math.max(this.loadedMemoriesCount, memoriesCount);

    this.addTraceEntry({
      executionId: this.executionId,
      timestamp: new Date().toISOString(),
      duration: 0,
      status: 'success',
      type: 'context',
      name: 'context.loaded',
      metadata: { filesCount, filesBytes, memoriesCount },
    });
  }

  public recordFailure(error: string, location?: { layerIndex?: number; taskId?: string }): void {
    this.failureLocation = {
      error,
      layerIndex: location?.layerIndex,
      taskId: location?.taskId,
    };
    this.failureHistory.push({
      error,
      layerIndex: location?.layerIndex,
      taskId: location?.taskId,
    });
    this.status = 'failed';

    this.addTraceEntry({
      executionId: this.executionId,
      layerId: location?.layerIndex,
      taskId: location?.taskId,
      timestamp: new Date().toISOString(),
      duration: 0,
      status: 'failed',
      type: 'execution',
      name: 'execution.failure',
      error,
    });
  }

  public endExecution(success: boolean, durationMs?: number): void {
    this.endTime = Date.now();
    this.status = success ? 'success' : 'failed';
    const total = durationMs ?? (this.endTime - this.startTime);
    this.totalDurationMs = total;

    this.addTraceEntry({
      executionId: this.executionId,
      timestamp: new Date().toISOString(),
      duration: total,
      status: this.status,
      type: 'execution',
      name: `execution.${this.status}`,
    });

    logger.debug('Execution telemetry finalized', {
      traceId: this.traceId,
      executionId: this.executionId,
      status: this.status,
      durationMs: total,
    });
  }

  private addTraceEntry(entry: ExecutionTraceEntry): void {
    this.traceEntries.push(entry);
  }

  public getTrace(): ExecutionTrace {
    return {
      traceId: this.traceId,
      executionId: this.executionId,
      planId: this.planId,
      success: this.status === 'success' ? true : this.status === 'failed' ? false : undefined,
      totalDurationMs: this.totalDurationMs ?? (this.endTime ? this.endTime - this.startTime : undefined),
      startTime: new Date(this.startTime).toISOString(),
      startedAt: this.startTime,
      endTime: this.endTime ? new Date(this.endTime).toISOString() : undefined,
      endedAt: this.endTime,
      metadata: this.metadata,
      entries: [...this.traceEntries],
      layers: [...this.layerHistory],
      failures: [...this.failureHistory],
    };
  }

  public getMetrics(): ExecutionMetrics {
    const totalTime = this.totalDurationMs ?? (this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime);
    const byTool: Record<string, ToolCallMetric> = {};
    const toolUsage: Record<string, { count: number; totalDurationMs: number; errors: number }> = {};
    for (const [slug, m] of this.toolMetrics.entries()) {
      byTool[slug] = { ...m };
      toolUsage[slug] = { count: m.calls, totalDurationMs: m.totalDurationMs, errors: m.errors };
    }

    const byModel: Record<string, ModelUsageMetric> = {};
    const modelUsage: Record<string, { invocations: number; promptTokens: number; completionTokens: number; totalTokens: number }> = {};
    for (const [modelId, m] of this.modelMetrics.entries()) {
      byModel[modelId] = { ...m };
      modelUsage[modelId] = { invocations: m.requests, promptTokens: m.promptTokens, completionTokens: m.completionTokens, totalTokens: m.totalTokens };
    }

    const totalToolCalls = Array.from(this.toolMetrics.values()).reduce((sum, t) => sum + t.calls, 0);
    const totalModelRequests = Array.from(this.modelMetrics.values()).reduce((sum, m) => sum + m.requests, 0);

    return {
      totalExecutionTimeMs: totalTime,
      totalDurationMs: totalTime,
      tasksTotal: this.tasksTotalCount,
      tasksCompleted: this.tasksCompletedCount,
      tasksFailed: this.tasksFailedCount,
      layerDurations: Object.fromEntries(this.layerDurations.entries()),
      taskDurations: Object.fromEntries(this.taskDurations.entries()),
      toolCalls: {
        total: totalToolCalls,
        byTool,
      },
      toolUsage,
      models: {
        totalRequests: totalModelRequests,
        selectedModels: Array.from(this.modelMetrics.keys()),
        byModel,
        tokenUsage: {
          promptTokens: this.promptTokens,
          completionTokens: this.completionTokens,
          totalTokens: this.promptTokens + this.completionTokens,
        },
      },
      modelUsage,
      context: {
        loadedFilesCount: this.loadedFilesCount,
        loadedFilesBytes: this.loadedFilesBytes,
        loadedMemoriesCount: this.loadedMemoriesCount,
      },
      contextMetrics: {
        peakFilesLoaded: this.loadedFilesCount,
        peakFileBytesLoaded: this.loadedFilesBytes,
        peakMemoriesRetrieved: this.loadedMemoriesCount,
      },
    };
  }

  public getSlowestLayer(): { layerIndex: number; layerId: string | number; durationMs: number } | undefined {
    let slowestLayer: { layerIndex: number; layerId: string | number; durationMs: number } | undefined;
    for (const [layerIndex, duration] of this.layerDurations.entries()) {
      if (!slowestLayer || duration > slowestLayer.durationMs) {
        slowestLayer = {
          layerIndex,
          layerId: layerIndex,
          durationMs: duration,
        };
      }
    }
    return slowestLayer;
  }

  public getSlowestTool(): { slug: string; durationMs: number; totalCalls: number } | undefined {
    let slowestTool: { slug: string; durationMs: number; totalCalls: number } | undefined;
    for (const [slug, metric] of this.toolMetrics.entries()) {
      if (!slowestTool || metric.totalDurationMs > slowestTool.durationMs) {
        slowestTool = {
          slug,
          durationMs: metric.totalDurationMs,
          totalCalls: metric.calls,
        };
      }
    }
    return slowestTool;
  }

  public getDiagnostics(): ExecutionDiagnostics {
    const metrics = this.getMetrics();
    const slowestLayer = this.getSlowestLayer();
    const slowestTool = this.getSlowestTool();
    const selectedModels = Array.from(this.modelMetrics.keys());
    const selectedModel = selectedModels[0];

    return {
      executionId: this.executionId,
      traceId: this.traceId,
      status: this.status,
      totalDurationMs: metrics.totalExecutionTimeMs,
      slowestLayer,
      slowestTool,
      selectedModel,
      selectedModels,
      tokenUsage: metrics.models.tokenUsage,
      failureLocation: this.failureLocation,
      contextSize: {
        filesCount: metrics.context.loadedFilesCount,
        filesBytes: metrics.context.loadedFilesBytes,
        memoriesCount: metrics.context.loadedMemoriesCount,
      },
      metrics,
      trace: this.getTrace(),
      diagnostics: {
        slowestLayer,
        slowestTool,
        peakFilesLoaded: metrics.context.loadedFilesCount,
        peakFileBytesLoaded: metrics.context.loadedFilesBytes,
        peakMemoriesRetrieved: metrics.context.loadedMemoriesCount,
      },
    };
  }

  public exportDiagnostics(): string {
    return JSON.stringify(this.getDiagnostics(), null, 2);
  }
}

export function createTelemetryEngine(executionIdOrTraceId?: string, traceId?: string): TelemetryEngine {
  return new TelemetryEngine(executionIdOrTraceId, traceId);
}
