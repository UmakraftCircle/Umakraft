import { z } from 'zod';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Validator');

// ── Core schemas ──

export const TaskStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export const AgentTaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  name: z.string().min(1, 'Task name is required'),
  toolSlug: z.string().min(1, 'Tool slug is required'),
  arguments: z.record(z.any()),
  dependencies: z.array(z.string()),
  status: TaskStatusSchema,
  result: z.any().optional(),
  error: z.string().optional(),
  retryCount: z.number().int().min(0),
  maxRetries: z.number().int().min(0)
});

export const ExecutionPlanSchema = z.object({
  id: z.string().min(1),
  intent: z.string().min(1),
  tasks: z.preprocess(
    (val: unknown) => {
      if (val instanceof Map) return Array.from((val as Map<string, unknown>).values());
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) return Object.values(val as Record<string, unknown>);
      return val;
    },
    z.array(AgentTaskSchema).min(1, 'Plan must contain at least one task'),
  ),
  metadata: z.object({
    modelUsed: z.string(),
    createdAt: z.string(),
    estimatedSteps: z.number().int().positive()
  })
});

export const ToolParameterSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string(),
  required: z.boolean(),
  enum: z.array(z.string()).optional()
});

export const ToolDefinitionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  parameters: z.record(ToolParameterSchema)
});

// ── Validation utilities ──

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a raw execution plan payload before it enters the scheduler.
 */
export function validateExecutionPlan(plan: unknown): ValidationResult {
  const result = ExecutionPlanSchema.safeParse(plan);

  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    logger.warn(`Plan validation failed: ${errors.join('; ')}`);
    return { valid: false, errors };
  }

  // Additional semantic checks
  const data = result.data;
  const taskIds = new Set(data.tasks.map(t => t.id));

  // Check that all dependency references are valid
  for (const task of data.tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) {
        return {
          valid: false,
          errors: [`Task "${task.id}" references unknown dependency "${dep}"`]
        };
      }
    }
  }

  // Check for self-dependencies
  for (const task of data.tasks) {
    if (task.dependencies.includes(task.id)) {
      return {
        valid: false,
        errors: [`Task "${task.id}" cannot depend on itself`]
      };
    }
  }

  logger.info(`Plan "${data.id}" passed validation with ${data.tasks.length} tasks.`);
  return { valid: true, errors: [] };
}

/**
 * Validates tool arguments against its declared parameter schema.
 */
export function validateToolArguments(
  toolSlug: string,
  params: Record<string, { type: string; required: boolean }>,
  args: Record<string, any>
): ValidationResult {
  const errors: string[] = [];

  for (const [key, param] of Object.entries(params)) {
    if (param.required && (args[key] === undefined || args[key] === null)) {
      errors.push(`Tool "${toolSlug}": required parameter "${key}" is missing`);
    }
    if (args[key] !== undefined && typeof args[key] !== param.type && param.type !== 'array' && param.type !== 'object') {
      errors.push(`Tool "${toolSlug}": parameter "${key}" expected type "${param.type}" but got "${typeof args[key]}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Checks a task dependency graph for cycles using Kahn's algorithm.
 */
export function detectCycles(tasks: Array<{ id: string; dependencies: string[] }>): string[] | null {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      adjacency.get(dep)?.push(task.id);
      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== tasks.length) {
    const remaining = tasks.filter(t => !sorted.includes(t.id)).map(t => t.id);
    return remaining; // these are in a cycle
  }

  return null; // no cycles
}
