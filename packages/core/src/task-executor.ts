import { AgentTask, createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';

const logger = createLogger('TaskExecutor');

export interface TaskExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  attempts: number;
}

export interface TaskExecutorOptions {
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  jitterFactor?: number;
  customRetryablePattern?: RegExp;
}

const DEFAULT_RETRYABLE_ERROR_PATTERNS = [
  /rate.?limit/i,
  /timeout/i,
  /too many requests/i,
  /429/,
  /503/,
  /temporarily/i,
  /transient/i,
  /temporary/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /socket hang up/i,
];

export function isRetryableError(error: string, customPattern?: RegExp): boolean {
  if (customPattern && customPattern.test(error)) {
    return true;
  }
  return DEFAULT_RETRYABLE_ERROR_PATTERNS.some((p) => p.test(error));
}

export interface TaskExecutor {
  executeTask(task: AgentTask): Promise<TaskExecutionResult>;
}

export class DefaultTaskExecutor implements TaskExecutor {
  private baseBackoffMs: number;
  private maxBackoffMs: number;
  private jitterFactor: number;
  private customRetryablePattern?: RegExp;

  constructor(
    private registry: ToolRegistry = ToolRegistry.getInstance(),
    options: TaskExecutorOptions = {}
  ) {
    this.baseBackoffMs = options.baseBackoffMs ?? 200;
    this.maxBackoffMs = options.maxBackoffMs ?? 10_000;
    this.jitterFactor = options.jitterFactor ?? 0.3;
    this.customRetryablePattern = options.customRetryablePattern;
  }

  /**
   * Executes a single AgentTask, applying tool execution, retry limits,
   * error classification, and exponential backoff with jitter.
   */
  public async executeTask(task: AgentTask): Promise<TaskExecutionResult> {
    logger.info(`Running task: [${task.id}] - "${task.name}" using tool: ${task.toolSlug}`);

    const maxRetries = task.maxRetries ?? 2;
    while (task.retryCount <= maxRetries) {
      const result = await this.registry.execute(task.toolSlug, task.arguments);

      if (result.success) {
        logger.info(`Task completed successfully: [${task.id}]`);
        return {
          success: true,
          data: result.data,
          attempts: task.retryCount + 1,
        };
      }

      task.retryCount++;
      const errorMsg = result.error ?? 'Unknown error';

      // Check if error is retryable
      if (!isRetryableError(errorMsg, this.customRetryablePattern)) {
        logger.warn(`Task failed with permanent error: [${task.id}]. Not retrying. Error: ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          attempts: task.retryCount,
        };
      }

      logger.warn(
        `Task failed (retryable): [${task.id}] (Attempt ${task.retryCount}/${maxRetries + 1}). Error: ${errorMsg}`
      );

      if (task.retryCount <= maxRetries) {
        const baseWait = Math.min(
          this.baseBackoffMs * Math.pow(2, task.retryCount - 1),
          this.maxBackoffMs
        );
        const jitter = Math.random() * baseWait * this.jitterFactor;
        await new Promise((resolve) => setTimeout(resolve, baseWait + jitter));
      }
    }

    logger.error(`Task execution permanently failed after ${task.retryCount} attempts: [${task.id}]`);
    return {
      success: false,
      error: `Exceeded max retries (${maxRetries})`,
      attempts: task.retryCount,
    };
  }
}
