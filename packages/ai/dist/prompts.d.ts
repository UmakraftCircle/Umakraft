export interface PromptTemplate {
    name: string;
    version: string;
    system: string;
    userTemplate: (variables: Record<string, string>) => string;
}
/**
 * Central prompt registry.
 * All system-level prompt templates live here so they can be versioned,
 * audited, and A/B tested without touching application code.
 */
export declare class PromptLibrary {
    private templates;
    constructor();
    /**
     * Registers a new prompt template.
     */
    register(template: PromptTemplate): void;
    /**
     * Renders a prompt by name with variable substitution.
     */
    render(name: string, variables?: Record<string, string>): {
        system: string;
        user: string;
    } | null;
    /**
     * Lists all registered template names.
     */
    list(): string[];
    private registerDefaults;
}
export declare const promptLibrary: PromptLibrary;
//# sourceMappingURL=prompts.d.ts.map