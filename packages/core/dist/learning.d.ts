export interface FailureObservation {
    taskId: string;
    taskName: string;
    toolSlug: string;
    errorMessage: string;
    timestamp: string;
    context?: string;
}
export interface AdaptationRule {
    id: string;
    pattern: string;
    suggestion: string;
    autoFix?: (args: Record<string, any>) => Record<string, any>;
    occurrences: number;
    lastSeen: string;
}
/**
 * Observational Learning Engine.
 *
 * Follows the platform principle: "Every failure is a free training signal.
 * The system must extract, persist, and apply lessons from errors without
 * human intervention."
 */
export declare class LearningEngine {
    private observations;
    private rules;
    private memoryStore?;
    private initialized;
    /**
     * @param memoryStore — optional persistent MemoryStore. When provided,
     *   the Learning Engine survives restarts; when omitted, falls back to
     *   in-memory-only mode (development / no-SQLite environments).
     */
    constructor(memoryStore?: any);
    /**
     * Initialize the engine by loading persisted observations and rules.
     * Must be called once before use if a MemoryStore is configured.
     */
    init(): Promise<void>;
    /**
     * Records a failure observation from the task execution pipeline.
     */
    recordFailure(observation: FailureObservation): Promise<void>;
    /**
     * Returns all learned adaptation rules for the Planner to inject into prompts.
     */
    getAdaptationRules(): AdaptationRule[];
    /**
     * Generates a "lessons learned" context block for the Planner's system prompt.
     */
    generatePlannerContext(): string;
    /**
     * Attempts to auto-correct task arguments based on learned patterns.
     * Applies all autoFix functions from matching adaptation rules.
     * Each autoFix function is responsible for checking whether its fix is needed.
     */
    applyFixes(toolSlug: string, args: Record<string, any>): Record<string, any>;
    /**
     * Returns a summary of all observations for debugging/dashboard views.
     */
    getStats(): {
        totalFailures: number;
        topRules: AdaptationRule[];
    };
    /**
     * Derives adaptation rules from failure observations using pattern matching.
     */
    private deriveRule;
}
//# sourceMappingURL=learning.d.ts.map