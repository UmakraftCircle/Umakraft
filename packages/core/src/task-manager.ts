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
  /transient/i,
  /temporary/i,
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
   *
   * Uses internal status maps (taskStatuses, taskResults, taskErrors) instead of
   * mutating AgentTask objects in-place. Any caller holding a reference to the
   * original plan sees consistent state until executePlan returns. (audit #4)
   */
  public async executePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
    logger.info(`Starting execution of plan: ${plan.id}`);

    // Internal tracking maps — avoids mutating shared plan objects mid-run
    const taskStatuses = new Map<string, 'pending' | 'running' | 'completed' | 'failed'>();
    const taskResults = new Map<string, any>();
    const taskErrors = new Map<string, string>();

    // Seed from tasks already completed in the plan
    for (const task of plan.tasks.values()) {
      const s = task.status === 'completed' ? 'completed' as const : 'pending' as const;
      taskStatuses.set(task.id, s);
      if (s === 'completed') {
        taskResults.set(task.id, task.result);
        logger.info(`Pre-completed task: [${task.id}]`);
      }
    }

    const activePromises = new Map<string, Promise<void>>();
    let hasFailed = false;

    const completedCount = () =>
      [...taskStatuses.values()].filter(s => s === 'completed').length;
    const terminalCount = () =>
      [...taskStatuses.values()].filter(s => s === 'completed' || s === 'failed').length;

    while (terminalCount() < plan.tasks.size && !hasFailed) {
      // Find all tasks that are "pending" and whose dependencies are fully met
      const executableTasks: AgentTask[] = [];

      for (const task of plan.tasks.values()) {
        if (taskStatuses.get(task.id) === 'pending') {
          const depsMet = task.dependencies.every(
            depId => taskStatuses.get(depId) === 'completed'
          );
          if (depsMet) {
            executableTasks.push(task);
          }
        }
      }

      // If no tasks are running and none are runnable, deadlock
      if (executableTasks.length === 0 && activePromises.size === 0) {
        const pending = Array.from(plan.tasks.values())
          .filter(t => taskStatuses.get(t.id) === 'pending')
          .map(t => `${t.id}(deps:[${t.dependencies.filter(d => taskStatuses.get(d) !== 'completed')}])`);
        logger.error(`Deadlock detected! Unresolved tasks: ${pending.join(', ')}`);
        hasFailed = true;
        break;
      }

      // Start all executable tasks
      for (const task of executableTasks) {
        taskStatuses.set(task.id, 'running');
        const promise = this.runTaskWithRetry(task, taskStatuses, taskResults, taskErrors)
          .then(() => {
            if (taskStatuses.get(task.id) === 'failed') {
              hasFailed = true;
            }
            activePromises.delete(task.id);
          })
          .catch((err) => {
            logger.error(`Unhandled error in task [${task.id}]: ${err.message}`);
            taskStatuses.set(task.id, 'failed');
            taskErrors.set(task.id, `Unexpected runtime error: ${err.message}`);
            hasFailed = true;
            activePromises.delete(task.id);
          });
        activePromises.set(task.id, promise);
      }

      if (activePromises.size > 0) {
        await Promise.race(activePromises.values());
      }
    }

    if (hasFailed) {
      if (activePromises.size > 0) {
        logger.warn(`Awaiting ${activePromises.size} in-flight task(s) before returning failed plan.`);
        await Promise.allSettled(activePromises.values());
      }
      logger.error(`Plan execution failed for plan ${plan.id}`);
    } else {
      logger.info(`Plan execution succeeded for plan ${plan.id}!`);
    }

    // Write final results back to the plan for callers reading it post-execution
    for (const task of plan.tasks.values()) {
      task.status = taskStatuses.get(task.id) ?? task.status;
      if (taskResults.has(task.id)) task.result = taskResults.get(task.id);
      if (taskErrors.has(task.id)) task.error = taskErrors.get(task.id);
    }

    return plan;
  }

  private async runTaskWithRetry(
    task: AgentTask,
    taskStatuses: Map<string, 'pending' | 'running' | 'completed' | 'failed'>,
    taskResults: Map<string, any>,
    taskErrors: Map<string, string>,
  ): Promise<void> {
    logger.info(`Running task: [${task.id}] - "${task.name}" using tool: ${task.toolSlug}`);

    while (task.retryCount <= task.maxRetries) {
      const result = await this.registry.execute(task.toolSlug, task.arguments);

      if (result.success) {
        taskStatuses.set(task.id, 'completed');
        taskResults.set(task.id, result.data);
        logger.info(`Task completed successfully: [${task.id}]`);
        return;
      }

      task.retryCount++;
      taskErrors.set(task.id, result.error ?? 'Unknown error');

      // Classify error — permanent errors should not be retried
      if (!isRetryable(taskErrors.get(task.id) || '')) {
        logger.warn(`Task failed with permanent error: [${task.id}]. Not retrying. Error: ${taskErrors.get(task.id)}`);
        taskStatuses.set(task.id, 'failed');
        return;
      }

      logger.warn(`Task failed (retryable): [${task.id}] (Attempt ${task.retryCount}/${task.maxRetries + 1}). Error: ${taskErrors.get(task.id)}`);

      if (task.retryCount <= task.maxRetries) {
        const baseWait = Math.min(200 * Math.pow(2, task.retryCount - 1), 10_000);
        const jitter = Math.random() * baseWait * 0.3;
        await new Promise(resolve => setTimeout(resolve, baseWait + jitter));
      }
    }

    taskStatuses.set(task.id, 'failed');
    logger.error(`Task execution permanently failed after ${task.retryCount} attempts: [${task.id}]`);
  }
}
