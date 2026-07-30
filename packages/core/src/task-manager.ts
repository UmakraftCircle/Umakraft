import { ExecutionPlan, AgentTask, createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';

const logger = createLogger('TaskManager');

// ── Error classification ──

const RETRYABLE_ERROR_PATTERNS = [
  /rate.?limit/i,
  /timeout/i,
  /too many requests/i,
  /429/,
  /503/,
  /temporarily/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /socket hang up/i,
];

function isRetryable(error: string): boolean {
  return RETRYABLE_ERROR_PATTERNS.some(p => p.test(error));
}

export class TaskManager {
  constructor(private registry: ToolRegistry = ToolRegistry.getInstance()) {}

  /**
   * Orchestrates the execution of a multi-step Agent plan in parallel,
   * respecting task dependency graphs, managing retries, and returning results.
   */
  public async executePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
    logger.info(`Starting execution of plan: ${plan.id}`);

    // Seed completedTasks from tasks already marked completed in the plan
    const completedTasks = new Set<string>();
    for (const task of plan.tasks.values()) {
      if (task.status === 'completed') {
        completedTasks.add(task.id);
        logger.info(`Pre-completed task: [${task.id}]`);
      }
    }

    const activePromises = new Map<string, Promise<void>>();
    let hasFailed = false;

    while (completedTasks.size < plan.tasks.size && !hasFailed) {
      // Find all tasks that are currently "pending" and whose dependencies are fully met
      const executableTasks: AgentTask[] = [];

      for (const task of plan.tasks.values()) {
        if (task.status === 'pending') {
          const depsMet = task.dependencies.every(depId => completedTasks.has(depId));
          if (depsMet) {
            executableTasks.push(task);
          }
        }
      }

      // If no tasks are running and none are runnable, but we haven't completed all of them,
      // then we must have an unresolved dependency deadlock.
      if (executableTasks.length === 0 && activePromises.size === 0) {
        const pending = Array.from(plan.tasks.values())
          .filter(t => t.status === 'pending');
        logger.error(
          `Deadlock detected! ${pending.length} stuck task(s): ` +
          pending.map(t => `${t.id}(deps:[${t.dependencies.filter(d => !completedTasks.has(d))}])`).join(', ')
        );

        // Mark stuck tasks as failed so the API response reflects the failure
        for (const task of pending) {
          task.status = 'failed';
          task.error = `Deadlock: unresolved dependencies [${task.dependencies.filter(d => !completedTasks.has(d)).join(', ')}]`;
        }
        hasFailed = true;
        break;
      }

      // Start all executable tasks
      for (const task of executableTasks) {
        task.status = 'running';
        const promise = this.runTaskWithRetry(task)
          .then(() => {
            if (task.status === 'completed') {
              completedTasks.add(task.id);
            } else if (task.status === 'failed') {
              hasFailed = true;
            }
            activePromises.delete(task.id);
          })
          .catch((err) => {
            // Unexpected runtime error — treat as permanent failure
            logger.error(`Unhandled error in task [${task.id}]: ${err.message}`);
            task.status = 'failed';
            task.error = `Unexpected runtime error: ${err.message}`;
            hasFailed = true;
            activePromises.delete(task.id);
          });
        activePromises.set(task.id, promise);
      }

      // Wait for at least one active task to complete before scanning again
      if (activePromises.size > 0) {
        await Promise.race(activePromises.values());
      }
    }

    if (hasFailed) {
      logger.error(`Plan execution failed for plan ${plan.id}`);
    } else {
      logger.info(`Plan execution succeeded for plan ${plan.id}!`);
    }

    return plan;
  }

  private async runTaskWithRetry(task: AgentTask): Promise<void> {
    logger.info(`Running task: [${task.id}] - "${task.name}" using tool: ${task.toolSlug}`);

    while (task.retryCount <= task.maxRetries) {
      const result = await this.registry.execute(task.toolSlug, task.arguments);

      if (result.success) {
        task.status = 'completed';
        task.result = result.data;
        logger.info(`Task completed successfully: [${task.id}]`);
        return;
      }

      task.retryCount++;
      task.error = result.error;

      // Classify error — permanent errors should not be retried
      if (!isRetryable(task.error || '')) {
        logger.warn(`Task failed with permanent error: [${task.id}]. Not retrying. Error: ${task.error}`);
        task.status = 'failed';
        return;
      }

      logger.warn(`Task failed (retryable): [${task.id}] (Attempt ${task.retryCount}/${task.maxRetries + 1}). Error: ${task.error}`);

      if (task.retryCount <= task.maxRetries) {
        // Exponential backoff with jitter: 200ms, 400ms, 800ms, ...
        const baseWait = Math.min(200 * Math.pow(2, task.retryCount - 1), 10_000);
        const jitter = Math.random() * baseWait * 0.3;
        await new Promise(resolve => setTimeout(resolve, baseWait + jitter));
      }
    }

    task.status = 'failed';
    logger.error(`Task execution permanently failed after ${task.retryCount} attempts: [${task.id}]`);
  }
}
