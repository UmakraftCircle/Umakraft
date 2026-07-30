import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('ToolRegistry');
export class ToolRegistry {
    static instance;
    tools = new Map();
    constructor() { }
    static getInstance() {
        if (!ToolRegistry.instance) {
            ToolRegistry.instance = new ToolRegistry();
        }
        return ToolRegistry.instance;
    }
    /**
     * Registers a brand new tool into the registry
     */
    register(tool) {
        if (this.tools.has(tool.slug)) {
            throw new Error(`Tool Registry Error: Tool with slug '${tool.slug}' already exists.`);
        }
        this.tools.set(tool.slug, tool);
        logger.info(`Successfully registered tool: ${tool.slug}`);
    }
    /**
     * Returns all registered tools mapped to LLM tool call schemas
     */
    getDeclarativeSchemas() {
        return Array.from(this.tools.values()).map(({ handler, ...schema }) => schema);
    }
    /**
     * Safely dispatches a tool execution request by its unique slug
     */
    async execute(slug, args) {
        const tool = this.tools.get(slug);
        if (!tool) {
            logger.error(`Execution failed: tool not found '${slug}'`);
            return {
                success: false,
                error: `Tool not found: no tool registered with slug '${slug}'`
            };
        }
        try {
            this.validateArguments(tool, args);
            logger.info(`Executing tool ${slug} with arguments`, args);
            const data = await tool.handler(args);
            return { success: true, data };
        }
        catch (error) {
            logger.error(`Execution failed for tool ${slug}: ${error?.message || error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    validateArguments(tool, args) {
        for (const [key, param] of Object.entries(tool.parameters)) {
            if (param.required && (args[key] === undefined || args[key] === null)) {
                throw new Error(`Validation Error: Parameter '${key}' is required for tool '${tool.slug}'`);
            }
            if (args[key] !== undefined && typeof args[key] !== param.type && param.type !== 'array' && param.type !== 'object') {
                throw new Error(`Validation Error: Parameter '${key}' must be of type '${param.type}'`);
            }
        }
    }
}
export const toolRegistry = ToolRegistry.getInstance();
//# sourceMappingURL=tool-registry.js.map