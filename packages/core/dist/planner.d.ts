import { ExecutionPlan } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';
import { AIService } from '@ai-agent-platform/ai';
export declare class Planner {
    private aiService;
    private registry;
    constructor(aiService: AIService, registry?: ToolRegistry);
    /**
     * Transforms natural language intent into a structured Directed Acyclic Graph (DAG) of AgentTasks
     */
    plan(intent: string): Promise<ExecutionPlan>;
    private detectCircularDependencies;
}
//# sourceMappingURL=planner.d.ts.map