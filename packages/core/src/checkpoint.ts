import type { ExecutionState } from './execution-state.js';

/**
 * Internal execution checkpoint representing durable, completed execution state.
 *
 * CRITICAL ARCHITECTURAL MANDATE:
 * Checkpoints store ONLY execution identifiers, completed task keys, structured outputs,
 * layer markers, and lightweight metadata.
 * Temporary execution contexts, loaded file buffers, ASTs, and tool instances MUST NEVER
 * be saved into checkpoints.
 */
export interface ExecutionCheckpoint {
  executionId: string;
  completedTasks: string[];
  outputs: Record<string, any>;
  currentLayer: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Classified failure types.
 */
export type FailureType =
  | 'tool_error'
  | 'model_timeout'
  | 'validation_failure'
  | 'scheduler_crash'
  | 'dependency_error';

/**
 * Recovery strategies based on failure classification.
 */
export type FailureRecoveryAction = 'retry_task' | 'resume_checkpoint' | 'abort';

export interface ClassifiedFailure {
  type: FailureType;
  recovery: FailureRecoveryAction;
  message: string;
  taskId?: string;
  layerIndex?: number;
}

/**
 * Classifies an execution failure into an internal failure type and recovery action.
 *
 * Classification rules:
 * - Tool error          -> Retry current task
 * - Model timeout       -> Retry current task
 * - Validation failure  -> Retry current task
 * - Scheduler crash     -> Resume from checkpoint
 * - Dependency error    -> Abort execution
 */
export function classifyFailure(
  error: any,
  context?: { taskId?: string; layerIndex?: number }
): ClassifiedFailure {
  const msg = typeof error === 'string' ? error : (error?.message ?? String(error));
  const lower = msg.toLowerCase();

  // Dependency error: circular dependencies, deadlocks, missing graph prerequisites
  if (
    lower.includes('dependency') ||
    lower.includes('deadlock') ||
    lower.includes('circular') ||
    lower.includes('unresolved tasks') ||
    lower.includes('cycle')
  ) {
    return {
      type: 'dependency_error',
      recovery: 'abort',
      message: msg,
      taskId: context?.taskId,
      layerIndex: context?.layerIndex,
    };
  }

  // Model timeout
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline exceeded') ||
    lower.includes('etimedout')
  ) {
    return {
      type: 'model_timeout',
      recovery: 'retry_task',
      message: msg,
      taskId: context?.taskId,
      layerIndex: context?.layerIndex,
    };
  }

  // Validation failure
  if (
    lower.includes('validation') ||
    lower.includes('prerequisite') ||
    lower.includes('schema') ||
    lower.includes('invalid argument') ||
    lower.includes('prevalidation')
  ) {
    return {
      type: 'validation_failure',
      recovery: 'retry_task',
      message: msg,
      taskId: context?.taskId,
      layerIndex: context?.layerIndex,
    };
  }

  // Scheduler crash: unexpected scheduler/runtime crash
  if (
    lower.includes('scheduler crash') ||
    lower.includes('crash') ||
    lower.includes('fatal error') ||
    lower.includes('unhandled engine error') ||
    lower.includes('out of memory')
  ) {
    return {
      type: 'scheduler_crash',
      recovery: 'resume_checkpoint',
      message: msg,
      taskId: context?.taskId,
      layerIndex: context?.layerIndex,
    };
  }

  // Default: Tool execution error
  return {
    type: 'tool_error',
    recovery: 'retry_task',
    message: msg,
    taskId: context?.taskId,
    layerIndex: context?.layerIndex,
  };
}

/**
 * Storage interface for persisting and restoring execution checkpoints.
 */
export interface CheckpointStore {
  saveCheckpoint(checkpoint: ExecutionCheckpoint): Promise<void> | void;
  loadCheckpoint(executionId: string): Promise<ExecutionCheckpoint | null> | ExecutionCheckpoint | null;
  deleteCheckpoint?(executionId: string): Promise<void> | void;
  listCheckpoints?(): Promise<ExecutionCheckpoint[]> | ExecutionCheckpoint[];
}

/**
 * Default in-memory checkpoint store providing snapshot isolation.
 */
export class InMemoryCheckpointStore implements CheckpointStore {
  private checkpoints: Map<string, ExecutionCheckpoint> = new Map();

  public saveCheckpoint(checkpoint: ExecutionCheckpoint): void {
    this.checkpoints.set(checkpoint.executionId, JSON.parse(JSON.stringify(checkpoint)));
  }

  public loadCheckpoint(executionId: string): ExecutionCheckpoint | null {
    const found = this.checkpoints.get(executionId);
    if (!found) return null;
    return JSON.parse(JSON.stringify(found));
  }

  public deleteCheckpoint(executionId: string): void {
    this.checkpoints.delete(executionId);
  }

  public listCheckpoints(): ExecutionCheckpoint[] {
    return Array.from(this.checkpoints.values()).map((cp) => JSON.parse(JSON.stringify(cp)));
  }

  public clear(): void {
    this.checkpoints.clear();
  }
}

/**
 * Global default in-memory checkpoint store.
 */
export const defaultCheckpointStore = new InMemoryCheckpointStore();

/**
 * Creates an ExecutionCheckpoint from an active ExecutionState.
 * Never serializes file contents or tool instances.
 */
export function createCheckpointFromState(
  state: ExecutionState,
  executionId?: string,
  currentLayer?: number
): ExecutionCheckpoint {
  return {
    executionId: executionId ?? state.plan.id,
    completedTasks: Array.from(state.completedTasks),
    outputs: Object.fromEntries(state.outputs.entries()),
    currentLayer: currentLayer ?? state.currentLayer,
    timestamp: new Date().toISOString(),
    metadata: {
      planId: state.plan.id,
      request: state.request,
      totalTasks: state.taskGraph.size,
      completedCount: state.completedTasks.size,
      ...(state.metadata ?? {}),
    },
  };
}

/**
 * Restores an ExecutionState instance from an ExecutionCheckpoint.
 */
export function restoreExecutionState(
  state: ExecutionState,
  checkpoint: ExecutionCheckpoint
): void {
  state.checkpoint = checkpoint;
  state.currentLayer = checkpoint.currentLayer;
  for (const taskId of checkpoint.completedTasks) {
    state.completedTasks.add(taskId);
    state.failedTasks.delete(taskId);
  }
  if (checkpoint.outputs) {
    for (const [taskId, output] of Object.entries(checkpoint.outputs)) {
      state.outputs.set(taskId, output);
    }
  }
  state.updateProgress(checkpoint.currentLayer);
}
