import { ExecutionPlan, AgentTask, createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';

const logger = createLogger('TaskManager');

export class TaskManager {
  constructor(private registry: ToolRegistry = ToolRegistry.getInstance()) {}

  /**
   * Orchestrates the execution of a multi-step Agent plan in parallel,
   * respecting task dependency graphs, managing retries, and returning results.
   */
  public async executePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
    logger.info(`Starting execution of plan: ${plan.id}`);

    const completedTasks = new Set<string>();
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
        logger.error(`Deadlock detected! Some task dependencies are unresolved.`);
        hasFailed = true;
        break;
      }

      // Start all executable tasks
      for (const task of executableTasks) {
        task.status = 'running';
        const promise = this.runTaskWithRetry(task).then(() => {
          if (task.status === 'completed') {
            completedTasks.add(task.id);
          } else if (task.status === 'failed') {
            hasFailed = true;
          }
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
      } else {
        task.retryCount++;
        task.error = result.error;
        logger.warn(`Task failed: [${task.id}] (Attempt ${task.retryCount}/${task.maxRetries + 1}). Error: ${result.error}`);

        if (task.retryCount <= task.maxRetries) {
          // Linear/exponential backoff wait
          const waitTime = task.retryCount * 200;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    task.status = 'failed';
    logger.error(`Task execution permanently failed after ${task.retryCount} attempts: [${task.id}]`);
  }
}
