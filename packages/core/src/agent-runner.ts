import { createLogger } from '@ai-agent-platform/shared';
import { AIService } from '@ai-agent-platform/ai';
import { Planner } from './planner.js';
import { TaskManager } from './task-manager.js';
import { ToolRegistry } from './tool-registry.js';
import type { ExecutionPlan } from '@ai-agent-platform/shared';

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
}

export interface TaskStateStoreLike {
  create(state: { taskId: string; userId: string; guildId: string | null; channelId: string | null; goal: string; currentStep: number }): Promise<void>;
  update(taskId: string, patch: Record<string, any>): Promise<void>;
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
 * Feature 4: orchestrates plan → execute with strict limits, persistent task
 * state, duplicate/loop detection, and secret-safe structured logging.
 * Reuses the existing Planner (intent → validated DAG) and TaskManager
 * (dependency-aware execution + retries). This runner is the guarded wrapper
 * the Discord layer calls.
 */
export class AgentRunner {
  constructor(
    private aiService: AIService,
    private registry: ToolRegistry = ToolRegistry.getInstance(),
    private taskStore?: TaskStateStoreLike,
    private limits: RunLimits = DEFAULT_RUN_LIMITS,
  ) {}

  async run(userId: string, goal: string, context?: { guildId?: string | null; channelId?: string | null }): Promise<AgentRunResult> {
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

      const planner = new Planner(this.aiService, this.registry);
      let plan: ExecutionPlan;
      try {
        plan = await this.withOverallTimeout(() => planner.plan(goal));
      } catch (err: any) {
        await persist({ status: 'failed' });
        return this.result(taskId, 'failed', 'Planning failed.', 0, 0, webSearches, [err?.message ?? 'planning error'], [], startedAt);
      }

      const taskCount = plan.tasks.size;
      if (taskCount > this.limits.maxPlanSteps) {
        const msg = `Plan exceeded ${this.limits.maxPlanSteps} steps (got ${taskCount}).`;
        await persist({ status: 'failed' });
        return this.result(taskId, 'failed', 'Plan was too complex.', 0, 0, webSearches, [msg], [], startedAt);
      }

      await persist({ status: 'running', planJson: null, currentStep: 0 });

      const taskManager = new TaskManager(this.registry);
      let executed: ExecutionPlan;
      try {
        executed = await this.withOverallTimeout(() => taskManager.executePlan(plan));
      } catch (err: any) {
        await persist({ status: 'failed' });
        return this.result(taskId, 'failed', 'Execution error.', taskCount, 0, webSearches, [err?.message ?? 'execution error'], [], startedAt);
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

      if (toolCalls > this.limits.maxToolCalls) {
        const msg = `tool-call limit ${this.limits.maxToolCalls} exceeded (${toolCalls})`;
        await persist({ status: 'failed' });
        return this.result(taskId, 'failed', 'Too many tool calls.', executed.tasks.size, toolCalls, webSearches, [msg], toolNamesUsed, startedAt);
      }
      if (webSearches > this.limits.maxWebSearches) {
        const msg = `web-search limit ${this.limits.maxWebSearches} exceeded (${webSearches})`;
        await persist({ status: 'failed' });
        return this.result(taskId, 'failed', 'Too many web searches.', executed.tasks.size, toolCalls, webSearches, [msg], toolNamesUsed, startedAt);
      }

      const allOk = [...executed.tasks.values()].every((t) => t.status === 'completed');
      const status: AgentRunResult['status'] = allOk ? 'completed' : 'failed';
      const answer = this.synthesize(executed, goal);

      await persist({
        status,
        completedStepsJson: JSON.stringify([...executed.tasks.keys()]),
        toolResultsJson: this.serializeResults(executed),
        errorsJson: JSON.stringify(errors),
        currentStep: executed.tasks.size,
      });

      this.logRun(taskId, status, executed.tasks.size, toolCalls, webSearches, errors.length, Date.now() - startedAt, toolNamesUsed);
      return this.result(taskId, status, answer, executed.tasks.size, toolCalls, webSearches, errors, toolNamesUsed, startedAt);
    } catch (err: any) {
      const msg = err?.message ?? 'unexpected error';
      await persist({ status: 'failed', errorsJson: JSON.stringify([msg]) });
      this.logRun(taskId, 'failed', 0, 0, webSearches, 1, Date.now() - startedAt, toolNamesUsed);
      return this.result(taskId, 'failed', 'Something went wrong.', 0, 0, webSearches, [msg], toolNamesUsed, startedAt);
    }
  }

  private async withOverallTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`overall timeout ${this.limits.overallTimeoutMs}ms`)), this.limits.overallTimeoutMs)),
    ]);
  }

  private serializeResults(plan: ExecutionPlan): string {
    try {
      const data = [...plan.tasks.values()].map((t) => ({ id: t.id, toolSlug: t.toolSlug, result: t.result }));
      return truncate(JSON.stringify(data), this.limits.maxResultBytes);
    } catch { return null as any; }
  }

  private synthesize(plan: ExecutionPlan, goal: string): string {
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
  ): AgentRunResult {
    return { taskId, status, answer, stepsExecuted, toolCalls, webSearches, errors, toolNamesUsed, durationMs: Date.now() - startedAt };
  }

  private logRun(taskId: string, status: string, steps: number, toolCalls: number, webSearches: number, errorCount: number, durationMs: number, tools: string[]) {
    logger.info(`[task=${taskId}] status=${status} steps=${steps} toolCalls=${toolCalls} webSearches=${webSearches} errors=${errorCount} durationMs=${durationMs} tools=[${[...new Set(tools)].join(',')}]`);
  }
}

function safeStringify(v: any): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}
