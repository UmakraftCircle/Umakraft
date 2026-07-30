import { ToolDefinition, ToolResult } from '@ai-agent-platform/shared';
export declare class ToolRegistry {
    private static instance;
    private tools;
    private constructor();
    static getInstance(): ToolRegistry;
    /**
     * Registers a brand new tool into the registry
     */
    register(tool: ToolDefinition): void;
    /**
     * Returns all registered tools mapped to LLM tool call schemas
     */
    getDeclarativeSchemas(): Array<Omit<ToolDefinition, 'handler'>>;
    /**
     * Safely dispatches a tool execution request by its unique slug
     */
    execute(slug: string, args: Record<string, any>): Promise<ToolResult>;
    private validateArguments;
}
export declare const toolRegistry: ToolRegistry;
//# sourceMappingURL=tool-registry.d.ts.map