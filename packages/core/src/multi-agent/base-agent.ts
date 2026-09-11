import { createLogger, Logger } from '@ai-agent-platform/shared';
import type { AIService } from '@ai-agent-platform/ai';
import { ToolCallingAgent, DEFAULT_AGENT_OPTIONS, ToolCallingAgentOptions } from '../tool-calling-agent.js';
import { ToolRegistry } from '../tool-registry.js';
import type { IAgent, AgentInput, AgentOutput, IAgentOrchestrator } from './types.js';

export abstract class BaseAgent implements IAgent {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly allowedTools: string[];

  protected logger: Logger;
  protected aiService: AIService;
  protected registry: ToolRegistry;

  constructor(aiService: AIService, registry?: ToolRegistry) {
    this.aiService = aiService;
    this.registry = registry ?? ToolRegistry.getInstance();
    this.logger = createLogger(this.constructor.name);
  }

  public abstract canHandle(input: AgentInput): Promise<number>;

  public abstract execute(input: AgentInput, orchestrator?: IAgentOrchestrator): Promise<AgentOutput>;

  /**
   * Helper to execute a scoped ToolCallingAgent with this agent's allowed tools.
   */
  protected async runToolCallingAgent(
    input: AgentInput,
    options?: Partial<ToolCallingAgentOptions>
  ): Promise<{ answer: string; toolsUsed: string[] }> {
    const toolsUsed: string[] = [];

    // Filter tools to only those allowed for this agent
    const allowed = this.allowedTools.length > 0
      ? this.allowedTools
      : undefined;

    const agent = new ToolCallingAgent(this.aiService, this.registry);

    const mergedOptions: ToolCallingAgentOptions = {
      ...DEFAULT_AGENT_OPTIONS,
      ...options,
      toolSlugs: allowed,
      logger: (entry) => {
        if (entry.event === 'tool_call' && entry.toolSlug) {
          if (!toolsUsed.includes(entry.toolSlug)) {
            toolsUsed.push(entry.toolSlug);
          }
        }
        if (options?.logger) {
          options.logger(entry);
        }
      },
    };

    const trace = await agent.runWithTrace(
      input.userId,
      input.message,
      input.context,
      mergedOptions
    );

    if (trace.logs) {
      for (const entry of trace.logs) {
        if (entry.event === 'tool_call' && entry.toolSlug) {
          if (!toolsUsed.includes(entry.toolSlug)) {
            toolsUsed.push(entry.toolSlug);
          }
        }
      }
    }

    return { answer: trace.answer, toolsUsed };
  }
}
