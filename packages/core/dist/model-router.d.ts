export interface ModelProfile {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'ollama';
    costPer1kTokens: {
        input: number;
        output: number;
    };
    contextWindow: number;
    capabilities: ('text' | 'structured-output' | 'vision' | 'code')[];
    isLocal: boolean;
}
export interface RoutingDecision {
    model: ModelProfile;
    estimatedCost: number;
    reason: string;
}
/**
 * Pre-configured model profiles with current pricing (as of 2026).
 */
export declare const MODELS: Record<string, ModelProfile>;
export interface RoutingContext {
    promptLength: number;
    requiresStructuredOutput: boolean;
    requiresVision: boolean;
    maxBudget?: number;
    preferLocal?: boolean;
}
export declare class ModelRouter {
    private profiles;
    constructor(customModels?: ModelProfile[]);
    /**
     * Routes a request to the most cost-effective model that meets requirements.
     * Follows the platform principle: "Routing is about cost and capability, not preference."
     */
    route(context: RoutingContext): RoutingDecision;
    /**
     * Returns the list of all available model profiles for UI/schema introspection.
     */
    getAvailableModels(): ModelProfile[];
}
//# sourceMappingURL=model-router.d.ts.map