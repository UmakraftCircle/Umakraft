import { ExecutionPlan, AgentTask, PlanValidationError, createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';
import { AIService } from '@ai-agent-platform/ai';
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
  maxRetries: z.number().int().min(0).max(10).optional(),
});

const RawPlanSchema = z.object({
  tasks: z.array(RawTaskSchema).min(1, 'Plan must contain at least one task'),
});

export class Planner {
  constructor(
    private aiService: AIService,
    private registry: ToolRegistry = ToolRegistry.getInstance()
  ) {}

  /**
   * Transforms natural language intent into a structured Directed Acyclic Graph (DAG) of AgentTasks
   */
  public async plan(intent: string): Promise<ExecutionPlan> {
    const availableTools = this.registry.getDeclarativeSchemas();

    logger.info(`Starting planning workflow for intent: "${intent}"`);

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
      tasksMap.set(taskData.id, {
        id: taskData.id,
        name: taskData.name,
        toolSlug: taskData.toolSlug,
        arguments: taskData.arguments,
        dependencies: taskData.dependencies,
        status: 'pending',
        retryCount: 0,
        maxRetries: taskData.maxRetries ?? 3
      });
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

    // Run full validation (includes cycle detection via Kahn's algorithm)
    const planId = `plan-${Date.now()}`;
    const validation = validateExecutionPlan({
      id: planId,
      intent,
      tasks: tasksMap,
      metadata: {
        modelUsed: this.aiService.getCurrentModel(),
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
        modelUsed: this.aiService.getCurrentModel(),
        createdAt: new Date().toISOString(),
        estimatedSteps: tasksMap.size
      }
    };
  }
}
