import { ToolDefinition, ToolResult, createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ToolRegistry');

// ── Secret redaction ──

const SENSITIVE_KEY_PATTERNS = [
  /key/i, /secret/i, /token/i, /password/i, /auth/i, /credential/i,
  /api[_-]?key/i, /access[_-]?token/i,
];

function redactArgs(args: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(args)) {
    if (SENSITIVE_KEY_PATTERNS.some(p => p.test(k))) {
      safe[k] = '[REDACTED]';
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

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
      logger.info(`Executing tool ${slug} with arguments`, redactArgs(args));
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

  private validateArguments(tool: ToolDefinition, args: Record<string, any>): void {
    for (const [key, param] of Object.entries(tool.parameters)) {
      if (param.required && (args[key] === undefined || args[key] === null)) {
        throw new Error(`Validation Error: Parameter '${key}' is required for tool '${tool.slug}'`);
      }
      if (args[key] !== undefined) {
        if (param.type === 'array') {
          if (!Array.isArray(args[key])) {
            throw new Error(`Validation Error: Parameter '${key}' must be an array for tool '${tool.slug}'`);
          }
        } else if (param.type === 'object') {
          if (typeof args[key] !== 'object' || args[key] === null || Array.isArray(args[key])) {
            throw new Error(`Validation Error: Parameter '${key}' must be an object for tool '${tool.slug}'`);
          }
        } else if (typeof args[key] !== param.type) {
          throw new Error(`Validation Error: Parameter '${key}' must be of type '${param.type}'`);
        }
      }
    }
  }
}
export const toolRegistry = ToolRegistry.getInstance();
