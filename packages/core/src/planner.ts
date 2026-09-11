import { ExecutionPlan, AgentTask, PlanValidationError, createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';
import { AIService } from '@ai-agent-platform/ai';
import { ModelRouter } from './model-router.js';
import { z } from 'zod';
import { validateExecutionPlan } from './validator.js';

const logger = createLogger('Planner');

// ── AI output schema validation ──

const RawTaskSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  toolSlug: z.string().min(1),
  arguments: z.record(z.any()).default({}),
  dependencies: z.array(z.string()).default([]),
  dependsOn: z.array(z.string()).optional(),
  layer: z.number().int().min(0).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

const RawPlanSchema = z.object({
  tasks: z.array(RawTaskSchema).min(1, 'Plan must contain at least one task'),
});

/**
 * Computes topological execution layers for all tasks in a dependency graph.
 * Root tasks (0 dependencies) belong to layer 0.
 * Tasks with dependencies are placed into layer max(dep.layer) + 1.
 */
export function computeGraphLayers(tasks: Map<string, AgentTask>): void {
  const layerMap = new Map<string, number>();
  const visited = new Set<string>();

  function resolveLayer(id: string): number {
    if (layerMap.has(id)) return layerMap.get(id)!;
    if (visited.has(id)) {
      return 0; // Avoid infinite recursion if cycles exist before formal cycle check
    }
    visited.add(id);

    const task = tasks.get(id);
    const deps = task?.dependencies ?? (task as any)?.dependsOn ?? [];
    if (!deps || deps.length === 0) {
      layerMap.set(id, 0);
      visited.delete(id);
      return 0;
    }

    let maxDep = -1;
    for (const depId of deps) {
      if (tasks.has(depId)) {
        maxDep = Math.max(maxDep, resolveLayer(depId));
      }
    }

    const calculated = maxDep + 1;
    layerMap.set(id, calculated);
    visited.delete(id);
    return calculated;
  }

  for (const task of tasks.values()) {
    const layer = (task as any).layer ?? resolveLayer(task.id);
    (task as any).layer = layer;
    (task as any).dependsOn = task.dependencies ?? (task as any).dependsOn ?? [];
    if (!task.dependencies) {
      task.dependencies = (task as any).dependsOn;
    }
  }
}

export class Planner {
  constructor(
    private aiService: AIService,
    private registry: ToolRegistry = ToolRegistry.getInstance(),
    private modelRouter?: ModelRouter
  ) {}

  /**
   * Transforms natural language intent into a structured Directed Acyclic Graph (DAG) of AgentTasks
   */
  public async plan(intent: string): Promise<ExecutionPlan> {
    const availableTools = this.registry.getDeclarativeSchemas();

    logger.info(`Starting planning workflow for intent: "${intent}"`);

    let modelUsed = this.aiService.getCurrentModel();
    if (this.modelRouter) {
      try {
        const decision = this.modelRouter.route({
          promptLength: Math.ceil(intent.length / 4) + 200,
          requiresStructuredOutput: true,
          requiresVision: false,
        });
        logger.info(`Planner routed to model: ${decision.model.name} (${decision.model.id})`);
        modelUsed = decision.model.id;
      } catch (err: any) {
        logger.warn(`Planner model routing skipped: ${err?.message}`);
      }
    }

    const systemPrompt = `
      You are the Master Planner for the AI Agent Platform. Your task is to plan the resolution of user requests.
      Break down the complex request into discrete tasks.

      Available declarative tools you can schedule:
      ${JSON.stringify(availableTools, null, 2)}
    `;

    const rawResult = await this.aiService.generateStructuredOutput({
      system: systemPrompt,
      prompt: `Plan a sequence of operations to solve this: "${intent}"`
    });

    // Validate AI output shape before building the plan
    const parsed = RawPlanSchema.safeParse(rawResult);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      logger.error(`AI planner returned invalid output: ${issues}`);
      throw new PlanValidationError(`AI generated an invalid plan structure: ${issues}`);
    }

    const tasksMap = new Map<string, AgentTask>();

    for (const taskData of parsed.data.tasks) {
      const deps = taskData.dependsOn ?? taskData.dependencies;
      tasksMap.set(taskData.id, {
        id: taskData.id,
        name: taskData.name,
        toolSlug: taskData.toolSlug,
        arguments: taskData.arguments,
        dependencies: deps,
        dependsOn: deps,
        layer: taskData.layer ?? 0,
        status: 'pending',
        retryCount: 0,
        maxRetries: taskData.maxRetries ?? 3
      } as AgentTask);
    }

    // Validate task map — checks unknown deps, self-deps, and cycles (audit #17, #18)
    const tasksArray = Array.from(tasksMap.values());

    // Check phantom dependencies (deps not in the task map)
    const taskIds = new Set(tasksMap.keys());
    for (const task of tasksArray) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          logger.error(`AI planner hallucinated unknown dependency: task "${task.id}" depends on nonexistent "${depId}"`);
          throw new PlanValidationError(
            `Plan validation failure: task "${task.id}" references unknown dependency "${depId}"`
          );
        }
      }
    }

    // Assign topological execution layers across the task dependency graph
    computeGraphLayers(tasksMap);

    // Run full validation (includes cycle detection via Kahn's algorithm)
    const planId = `plan-${Date.now()}`;
    const validation = validateExecutionPlan({
      id: planId,
      intent,
      tasks: tasksMap,
      metadata: {
        modelUsed,
        createdAt: new Date().toISOString(),
        estimatedSteps: tasksMap.size,
      },
    });
    if (!validation.valid) {
      throw new PlanValidationError(`AI generated an invalid plan: ${validation.errors.join('; ')}`);
    }

    logger.info(`Planning complete. Generated ${tasksMap.size} tasks.`);

    return {
      id: planId,
      intent,
      tasks: tasksMap,
      metadata: {
        modelUsed,
        createdAt: new Date().toISOString(),
        estimatedSteps: tasksMap.size
      }
    };
  }
}
