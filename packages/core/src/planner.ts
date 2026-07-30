import { ExecutionPlan, AgentTask, PlanValidationError, createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';
import { AIService } from '@ai-agent-platform/ai';

const logger = createLogger('Planner');

// ── Input shape expected from AI structured output ──

interface RawTask {
  id: string;
  name: string;
  toolSlug: string;
  arguments: Record<string, any>;
  dependencies: string[];
  maxRetries?: number;
}

export class Planner {
  constructor(
    private aiService: AIService,
    private registry: ToolRegistry = ToolRegistry.getInstance()
  ) {}

  /**
   * Transforms natural language intent into a structured Directed Acyclic Graph (DAG) of AgentTasks.
   * Validates AI output before constructing the plan — rejects malformed tasks, duplicate IDs,
   * unknown tool slugs, and unresolvable dependency references.
   */
  public async plan(intent: string): Promise<ExecutionPlan> {
    const availableTools = this.registry.getDeclarativeSchemas();

    logger.info(`Starting planning workflow for intent: "${intent}"`);

    const systemPrompt = `
      You are the Master Planner for the AI Agent Platform. Your task is to plan the resolution of user requests.
      Break down the complex request into discrete tasks.

      Available declarative tools you can schedule:
      ${JSON.stringify(availableTools, null, 2)}

      Respond with a JSON object containing a "tasks" array. Each task must have:
      - id (unique string, kebab-case like "fetch-user" or "task-1")
      - name (short human-readable label)
      - toolSlug (must match exactly one of the available tool slugs above)
      - arguments (object of parameter values)
      - dependencies (array of task IDs that must complete first)
      - maxRetries (optional integer, default 3)
    `;

    const rawResult = await this.aiService.generateStructuredOutput({
      system: systemPrompt,
      prompt: `Plan a sequence of operations to solve this: "${intent}"`
    });

    // ── Validate raw AI output ──
    if (!rawResult || typeof rawResult !== 'object') {
      throw new PlanValidationError('AI returned non-object output. Expected { tasks: [...] }');
    }

    const rawTasks = rawResult.tasks;
    if (!Array.isArray(rawTasks)) {
      throw new PlanValidationError(
        `AI output "tasks" must be an array. Got: ${typeof rawTasks}`
      );
    }
    if (rawTasks.length === 0) {
      throw new PlanValidationError('AI generated an empty task list. Cannot create plan.');
    }

    const tasksMap = new Map<string, AgentTask>();
    const validToolSlugs = new Set(this.registry.getDeclarativeSchemas().map(t => t.slug));

    for (const raw of rawTasks as RawTask[]) {
      // ── Required fields ──
      if (!raw.id || typeof raw.id !== 'string') {
        throw new PlanValidationError(`Task missing valid "id": ${JSON.stringify(raw)}`);
      }
      if (!raw.name || typeof raw.name !== 'string') {
        throw new PlanValidationError(`Task "${raw.id}" missing valid "name"`);
      }
      if (!raw.toolSlug || typeof raw.toolSlug !== 'string') {
        throw new PlanValidationError(`Task "${raw.id}" missing valid "toolSlug"`);
      }

      // ── Duplicate ID check ──
      if (tasksMap.has(raw.id)) {
        throw new PlanValidationError(
          `Duplicate task ID "${raw.id}". Each task must have a unique ID.`
        );
      }

      // ── Unknown tool slug ──
      if (!validToolSlugs.has(raw.toolSlug)) {
        throw new PlanValidationError(
          `Task "${raw.id}" references unknown tool "${raw.toolSlug}". ` +
          `Available tools: ${[...validToolSlugs].slice(0, 10).join(', ')}`
        );
      }

      // ── Arguments must be an object ──
      const taskArgs = raw.arguments;
      if (taskArgs !== undefined && (typeof taskArgs !== 'object' || Array.isArray(taskArgs) || taskArgs === null)) {
        throw new PlanValidationError(
          `Task "${raw.id}" arguments must be an object. Got: ${typeof taskArgs}`
        );
      }

      // ── Dependencies must be an array of strings ──
      const deps = raw.dependencies;
      if (deps !== undefined) {
        if (!Array.isArray(deps)) {
          throw new PlanValidationError(
            `Task "${raw.id}" dependencies must be an array. Got: ${typeof deps}`
          );
        }
        for (const dep of deps) {
          if (typeof dep !== 'string') {
            throw new PlanValidationError(
              `Task "${raw.id}" has non-string dependency: ${JSON.stringify(dep)}`
            );
          }
        }
      }

      // ── maxRetries must be a non-negative integer ──
      let maxRetries = 3;
      if (raw.maxRetries !== undefined) {
        if (typeof raw.maxRetries !== 'number' || !Number.isInteger(raw.maxRetries) || raw.maxRetries < 0) {
          throw new PlanValidationError(
            `Task "${raw.id}" has invalid maxRetries: ${raw.maxRetries}. Must be a non-negative integer.`
          );
        }
        maxRetries = raw.maxRetries;
      }

      tasksMap.set(raw.id, {
        id: raw.id,
        name: raw.name,
        toolSlug: raw.toolSlug,
        arguments: taskArgs || {},
        dependencies: deps || [],
        status: 'pending',
        retryCount: 0,
        maxRetries,
      });
    }

    // ── Validate dependency references ──
    for (const task of tasksMap.values()) {
      for (const depId of task.dependencies) {
        if (!tasksMap.has(depId)) {
          throw new PlanValidationError(
            `Task "${task.id}" references unknown dependency "${depId}"`
          );
        }
      }
    }

    // ── Self-dependency check ──
    for (const task of tasksMap.values()) {
      if (task.dependencies.includes(task.id)) {
        throw new PlanValidationError(`Task "${task.id}" cannot depend on itself`);
      }
    }

    // ── Cycle detection ──
    this.detectCircularDependencies(tasksMap);

    logger.info(`Planning complete. Generated ${tasksMap.size} tasks.`);

    return {
      id: `plan-${Date.now()}`,
      intent,
      tasks: tasksMap,
      metadata: {
        modelUsed: this.aiService.getCurrentModel(),
        createdAt: new Date().toISOString(),
        estimatedSteps: tasksMap.size
      }
    };
  }

  private detectCircularDependencies(tasks: Map<string, AgentTask>): void {
    const visited: Record<string, boolean> = {};
    const recStack: Record<string, boolean> = {};

    const hasCycle = (id: string): boolean => {
      if (!visited[id]) {
        visited[id] = true;
        recStack[id] = true;

        const task = tasks.get(id);
        if (task) {
          for (const depId of task.dependencies) {
            if (depId === id) return true;
            if (!visited[depId] && hasCycle(depId)) return true;
            else if (recStack[depId]) return true;
          }
        }
      }
      recStack[id] = false;
      return false;
    };

    for (const id of tasks.keys()) {
      if (hasCycle(id)) {
        throw new PlanValidationError(
          'Plan Validation Failure: Cycle detected in generated AI plan dependencies.'
        );
      }
    }
  }
}
