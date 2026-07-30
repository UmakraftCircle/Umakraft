import { ExecutionPlan } from '@ai-agent-platform/shared';
import { ToolRegistry } from './tool-registry.js';
export declare class TaskManager {
    private registry;
    constructor(registry?: ToolRegistry);
    /**
     * Orchestrates the execution of a multi-step Agent plan in parallel,
     * respecting task dependency graphs, managing retries, and returning results.
     */
    executePlan(plan: ExecutionPlan): Promise<ExecutionPlan>;
    private runTaskWithRetry;
}
//# sourceMappingURL=task-manager.d.ts.map