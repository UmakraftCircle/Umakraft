import { ToolDefinition, ToolResult, createLogger } from '@ai-agent-platform/shared';
import { validateToolArguments } from './validator.js';

const logger = createLogger('ToolRegistry');

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Registers a brand new tool into the registry
   */
  public register(tool: ToolDefinition): void {
    if (this.tools.has(tool.slug)) {
      throw new Error(`Tool Registry Error: Tool with slug '${tool.slug}' already exists.`);
    }
    this.tools.set(tool.slug, tool);
    logger.info(`Successfully registered tool: ${tool.slug}`);
  }

  /**
   * Returns all registered tools mapped to LLM tool call schemas
   */
  public getDeclarativeSchemas(): Array<Omit<ToolDefinition, 'handler'>> {
    return Array.from(this.tools.values()).map(({ handler, ...schema }) => schema);
  }

  /**
   * Safely dispatches a tool execution request by its unique slug
   */
  public async execute(slug: string, args: Record<string, any>): Promise<ToolResult> {
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
    } catch (error: any) {
      logger.error(`Execution failed for tool ${slug}: ${error?.message || error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validates tool arguments against the declared parameter schema.
   * Uses shared validator with full array/object/enum support.
   */
  private validateArguments(tool: ToolDefinition, args: Record<string, any>): void {
    // Convert param definitions to the format expected by validateToolArguments
    const params: Record<string, { type: string; required: boolean; enum?: string[] }> = {};
    for (const [key, param] of Object.entries(tool.parameters)) {
      params[key] = {
        type: param.type,
        required: param.required ?? false,
        enum: param.enum,
      };
    }

    const result = validateToolArguments(tool.slug, params, args);
    if (!result.valid) {
      throw new Error(`Validation Error: ${result.errors.join('; ')}`);
    }
  }
}
export const toolRegistry = ToolRegistry.getInstance();
