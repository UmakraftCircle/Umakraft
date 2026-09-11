import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from '@ai-agent-platform/ai';
import { ToolRegistry } from '../tool-registry.js';
import type {
  IAgent,
  IAgentOrchestrator,
  AgentInput,
  AgentOutput,
  AgentDelegationRecord,
  AgentRoutingDecision,
} from './types.js';
import { RouterAgent } from './router-agent.js';
import { KnowledgeAgent } from './knowledge-agent.js';
import { MemoryAgent } from './memory-agent.js';
import { ToolAgent } from './tool-agent.js';
import { ModerationAgent } from './moderation-agent.js';

const logger = createLogger('AgentOrchestrator');

export interface AgentOrchestratorOptions {
  aiService: AIService;
  registry?: ToolRegistry;
  maxDelegationDepth?: number;
}

export class AgentOrchestrator implements IAgentOrchestrator {
  private aiService: AIService;
  private registry: ToolRegistry;
  private agents: Map<string, IAgent> = new Map();
  private routerAgent: RouterAgent;
  private maxDelegationDepth: number;

  constructor(options: AgentOrchestratorOptions) {
    this.aiService = options.aiService;
    this.registry = options.registry ?? ToolRegistry.getInstance();
    this.maxDelegationDepth = options.maxDelegationDepth ?? 3;
    this.routerAgent = new RouterAgent(this.aiService);

    // Register standard specialized agents
    this.registerAgent(new KnowledgeAgent(this.aiService, this.registry));
    this.registerAgent(new MemoryAgent(this.aiService, this.registry));
    this.registerAgent(new ToolAgent(this.aiService, this.registry));
    this.registerAgent(new ModerationAgent(this.aiService, this.registry));
  }

  public getAiService(): AIService {
    return this.aiService;
  }

  public getRegistry(): ToolRegistry {
    return this.registry;
  }

  public getRouterAgent(): RouterAgent {
    return this.routerAgent;
  }

  public registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
    logger.info(`[Orchestrator] Registered agent: ${agent.name} (${agent.id})`);
  }

  public getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  public listAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Evaluates intent and executes the most suitable specialized agent.
   */
  public async routeAndExecute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const candidateList = this.listAgents();

    // 1. Classify intent via RouterAgent
    const decision = await this.routerAgent.classify(input, candidateList);

    logger.info(
      `[Orchestrator] Routing user ${input.userId} to agent "${decision.selectedAgentId}" (confidence: ${decision.confidence.toFixed(2)}, isFallback: ${decision.isFallback})`
    );

    // 2. Dispatch to selected agent
    const targetAgent = this.getAgent(decision.selectedAgentId);

    if (targetAgent) {
      try {
        const output = await targetAgent.execute(input, this);
        const totalDuration = Date.now() - startTime;

        logger.info(
          `[Orchestrator] Completed execution via ${targetAgent.name} in ${totalDuration}ms | Tools used: [${output.toolsUsed.join(', ')}] | Delegations: ${output.delegations?.length ?? 0}`
        );

        return {
          ...output,
          confidence: decision.confidence,
          metadata: {
            ...output.metadata,
            routingDecision: decision,
            totalDurationMs: totalDuration,
          },
        };
      } catch (err: any) {
        logger.error(`[Orchestrator] Execution failed on ${targetAgent.id}: ${err?.message ?? err}`);
      }
    }

    // 3. Fallback: If no specialized agent or execution failed, run ToolAgent / general fallback
    const fallbackAgent = this.getAgent('tool-agent') || candidateList[0];
    if (fallbackAgent) {
      const fallbackOutput = await fallbackAgent.execute(input, this);
      return {
        ...fallbackOutput,
        status: 'fallback',
        confidence: 0.5,
        metadata: {
          fallbackReason: `Could not complete with ${decision.selectedAgentId}`,
          routingDecision: decision,
        },
      };
    }

    return {
      agentId: 'orchestrator-fallback',
      agentName: 'Orchestrator Fallback',
      answer: 'Unable to process your request at this time.',
      status: 'failed',
      toolsUsed: [],
      durationMs: Date.now() - startTime,
      error: 'No available agent could process the input.',
    };
  }

  /**
   * Inter-agent task delegation with recursion guard and context passing.
   */
  public async delegate(
    fromAgentId: string,
    toAgentId: string,
    input: AgentInput
  ): Promise<AgentOutput> {
    const startTime = Date.now();
    const currentChain = input.delegationChain || [];

    // Guard: Prevent cyclic delegation and limit recursion depth
    if (currentChain.includes(toAgentId)) {
      const errorMsg = `Cyclic delegation rejected: ${currentChain.join(' -> ')} -> ${toAgentId}`;
      logger.warn(`[Orchestrator] ${errorMsg}`);
      return {
        agentId: toAgentId,
        agentName: toAgentId,
        answer: '',
        status: 'failed',
        toolsUsed: [],
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }

    if (currentChain.length >= (input.maxDelegations ?? this.maxDelegationDepth)) {
      const errorMsg = `Max delegation depth (${this.maxDelegationDepth}) exceeded for chain: ${currentChain.join(' -> ')}`;
      logger.warn(`[Orchestrator] ${errorMsg}`);
      return {
        agentId: toAgentId,
        agentName: toAgentId,
        answer: '',
        status: 'failed',
        toolsUsed: [],
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }

    const targetAgent = this.getAgent(toAgentId);
    if (!targetAgent) {
      const errorMsg = `Target delegation agent "${toAgentId}" not found`;
      logger.error(`[Orchestrator] ${errorMsg}`);
      return {
        agentId: toAgentId,
        agentName: toAgentId,
        answer: '',
        status: 'failed',
        toolsUsed: [],
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }

    const nextChain = [...currentChain, fromAgentId];
    logger.info(`[Orchestrator] Delegating task from ${fromAgentId} to ${toAgentId} (chain: ${nextChain.join(' -> ')})`);

    const delegatedInput: AgentInput = {
      ...input,
      delegationChain: nextChain,
    };

    const output = await targetAgent.execute(delegatedInput, this);
    const durationMs = Date.now() - startTime;

    logger.info(`[Orchestrator] Delegation ${fromAgentId} -> ${toAgentId} completed in ${durationMs}ms (status: ${output.status})`);
    return output;
  }
}
