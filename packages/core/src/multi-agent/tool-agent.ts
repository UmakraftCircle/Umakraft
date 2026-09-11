import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput, IAgentOrchestrator } from './types.js';

export const TOOL_AGENT_SYSTEM_PROMPT = `You are the specialized Tool & Workflow Execution Agent for the Umakraft platform.
Your objective is to execute external tools, search live databases, query trainer statistics, inspect Uma Musume records, and perform web searches to answer user requests.

Operating Guidelines:
1. Choose the most specific tool for the requested operation.
2. For fan tracker and trainer queries, use get_trainer_stats, search_trainers, or get_leaderboard.
3. For live web info or external facts, use search_web.
4. Format all numbers, ranks, and statistics clearly for Discord.`;

export class ToolAgent extends BaseAgent {
  public readonly id = 'tool-agent';
  public readonly name = 'Tool Agent';
  public readonly description = 'Executes domain tools, fan tracker statistics, leaderboard lookups, web search, pure DB searches, and multi-step workflows.';
  public readonly allowedTools = [
    'get_trainer_stats',
    'search_trainers',
    'get_leaderboard',
    'search_web',
    'umamusume-puredb-search',
    'umamusume-character-search',
    'umamusume-factor-search',
    'umamusume-search',
    'umamusume-compile',
    'umamusume-list-sources',
  ];

  public async canHandle(input: AgentInput): Promise<number> {
    const text = input.message.toLowerCase();

    // High confidence triggers
    const strongPatterns = [
      /\b(trainer|leaderboard|fans?|fan count|stats|ranking|gain)\b/i,
      /\b(search web|google|look up online|latest news)\b/i,
      /\b(puredb|pure db|factor|support card|inheritance|spark|affinity)\b/i,
      /\bwho has the most fans\b/i,
      /\b(top 10|top 20|circle ranking)\b/i,
    ];

    for (const pattern of strongPatterns) {
      if (pattern.test(text)) {
        return 0.90;
      }
    }

    // Medium confidence triggers
    const mediumPatterns = [
      /\b(calculate|search|find|lookup)\b/i,
    ];

    for (const pattern of mediumPatterns) {
      if (pattern.test(text)) {
        return 0.65;
      }
    }

    return 0.1;
  }

  public async execute(input: AgentInput, orchestrator?: IAgentOrchestrator): Promise<AgentOutput> {
    const startTime = Date.now();
    this.logger.info(`[ToolAgent] Processing tool execution task for user ${input.userId}: "${input.message}"`);

    try {
      // Check if knowledge delegation is needed
      const needsKnowledgeDelegation = /\b(docs?|documentation|architecture|deployment|spec)\b/i.test(input.message) &&
        orchestrator &&
        (!input.delegationChain || !input.delegationChain.includes('knowledge-agent'));

      let delegatedResult: AgentOutput | undefined;
      if (needsKnowledgeDelegation && orchestrator) {
        this.logger.info(`[ToolAgent] Delegating documentation subtask to KnowledgeAgent`);
        delegatedResult = await orchestrator.delegate(this.id, 'knowledge-agent', input);
      }

      const context = input.context
        ? `${input.context}\n${delegatedResult ? `\n[Knowledge Context]: ${delegatedResult.answer}` : ''}`
        : delegatedResult ? `[Knowledge Context]: ${delegatedResult.answer}` : undefined;

      const { answer, toolsUsed } = await this.runToolCallingAgent(
        { ...input, context },
        {
          systemPromptPrefix: TOOL_AGENT_SYSTEM_PROMPT,
          domainGuard: false,
          maxToolCalls: 10,
          maxWebSearches: 3,
          toolTimeoutMs: 12_000,
        }
      );

      const durationMs = Date.now() - startTime;
      const allTools = [...toolsUsed, ...(delegatedResult?.toolsUsed || [])];

      return {
        agentId: this.id,
        agentName: this.name,
        answer,
        status: 'completed',
        toolsUsed: Array.from(new Set(allTools)),
        durationMs,
        delegations: delegatedResult ? [
          {
            fromAgentId: this.id,
            toAgentId: 'knowledge-agent',
            task: input.message,
            durationMs: delegatedResult.durationMs,
            success: delegatedResult.status === 'completed',
            toolsUsed: delegatedResult.toolsUsed,
          }
        ] : undefined,
      };
    } catch (err: any) {
      this.logger.error(`[ToolAgent] Execution failed: ${err?.message ?? err}`);
      return {
        agentId: this.id,
        agentName: this.name,
        answer: 'I encountered an error executing the requested tools or actions.',
        status: 'failed',
        toolsUsed: [],
        durationMs: Date.now() - startTime,
        error: err?.message ?? String(err),
      };
    }
  }
}
