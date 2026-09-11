import type { AIService } from '@ai-agent-platform/ai';
import type { ToolRegistry } from '../tool-registry.js';

export interface AgentInput {
  userId: string;
  channelId?: string;
  guildId?: string | null;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
  delegationChain?: string[];
  maxDelegations?: number;
}

export interface AgentDelegationRecord {
  fromAgentId: string;
  toAgentId: string;
  task: string;
  durationMs: number;
  success: boolean;
  error?: string;
  toolsUsed?: string[];
}

export interface AgentOutput {
  agentId: string;
  agentName: string;
  answer: string;
  status: 'completed' | 'failed' | 'fallback' | 'delegated';
  toolsUsed: string[];
  retrievalsCount?: number;
  durationMs: number;
  delegations?: AgentDelegationRecord[];
  confidence?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface AgentRoutingDecision {
  selectedAgentId: string;
  confidence: number;
  reasoning: string;
  candidateScores: Record<string, number>;
  isFallback: boolean;
  intent: 'knowledge' | 'memory' | 'tool' | 'moderation' | 'chat' | 'ask';
}

export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly allowedTools: string[];

  /**
   * Evaluates how well this agent can handle the input.
   * Returns a confidence score between 0.0 (cannot handle) and 1.0 (exact match).
   */
  canHandle(input: AgentInput): Promise<number>;

  /**
   * Executes the agent logic, leveraging ToolCallingAgent or domain services.
   */
  execute(input: AgentInput, orchestrator?: IAgentOrchestrator): Promise<AgentOutput>;
}

export interface IAgentOrchestrator {
  getAiService(): AIService;
  getRegistry(): ToolRegistry;
  getAgent(id: string): IAgent | undefined;
  listAgents(): IAgent[];
  registerAgent(agent: IAgent): void;

  /**
   * Routes an input to the optimal specialized agent and executes it.
   */
  routeAndExecute(input: AgentInput): Promise<AgentOutput>;

  /**
   * Delegates a subtask from one agent to another.
   */
  delegate(fromAgentId: string, toAgentId: string, input: AgentInput): Promise<AgentOutput>;
}
