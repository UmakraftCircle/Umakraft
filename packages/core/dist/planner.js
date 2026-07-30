import { PlanValidationError, createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';
const logger = createLogger('Planner');
export class Planner {
    aiService;
    registry;
    constructor(aiService, registry = ToolRegistry.getInstance()) {
        this.aiService = aiService;
        this.registry = registry;
    }
    /**
     * Transforms natural language intent into a structured Directed Acyclic Graph (DAG) of AgentTasks
     */
    async plan(intent) {
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
        const tasksMap = new Map();
        for (const taskData of rawResult.tasks) {
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
        // Cycle detection
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
    detectCircularDependencies(tasks) {
        const visited = {};
        const recStack = {};
        const hasCycle = (id) => {
            if (!visited[id]) {
                visited[id] = true;
                recStack[id] = true;
                const task = tasks.get(id);
                if (task) {
                    for (const depId of task.dependencies) {
                        // Self-dependency check
                        if (depId === id) {
                            return true;
                        }
                        if (!visited[depId] && hasCycle(depId)) {
                            return true;
                        }
                        else if (recStack[depId]) {
                            return true;
                        }
                    }
                }
            }
            recStack[id] = false;
            return false;
        };
        for (const id of tasks.keys()) {
            if (hasCycle(id)) {
                throw new PlanValidationError(`Plan Validation Failure: Cycle detected in generated AI plan dependencies.`);
            }
        }
    }
}
//# sourceMappingURL=planner.js.map