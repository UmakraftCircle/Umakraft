import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput, IAgentOrchestrator } from './types.js';
import { knowledgeService } from '@ai-agent-platform/integrations';

export const KNOWLEDGE_AGENT_SYSTEM_PROMPT = `You are the specialized Knowledge & Documentation Agent for the Umakraft platform.
Your objective is to provide strictly grounded, factual answers based on project documentation, architecture specs, deployment guides, and knowledge sources.

Operating Guidelines:
1. Always use the search_knowledge or retrieve_document tools to query verified documentation before answering.
2. If asked to summarize a document, use summarize_document or retrieve_document first.
3. Cite the exact document title and source path (e.g. docs/architecture/...) in your response.
4. If information is not found in the knowledge base, state clearly that it is not documented—do NOT hallucinate.
5. Provide clean, well-structured markdown answers.`;

export class KnowledgeAgent extends BaseAgent {
  public readonly id = 'knowledge-agent';
  public readonly name = 'Knowledge Agent';
  public readonly description = 'Answers questions using grounded RAG, searches project documentation, retrieves specs, and summarizes uploaded documents.';
  public readonly allowedTools = [
    'search_knowledge',
    'retrieve_document',
    'summarize_document',
    'list_knowledge_sources',
  ];

  public async canHandle(input: AgentInput): Promise<number> {
    const text = input.message.toLowerCase();

    // High confidence triggers
    const strongPatterns = [
      /\b(docs?|documents?|documentation|architecture|deployment|deploy|spec|specs|specification|blueprint|knowledge|guide|manual)\b/i,
      /\bhow do (i|we) (deploy|run|build|configure|setup|install)\b/i,
      /\bwhere is .* (documented|specified|defined)\b/i,
      /\bwhat do the (project )?docs say\b/i,
      /\b(summarize|summary of)\b.*\b(doc|document|docs|documentation|specification|spec)\b/i,
    ];

    for (const pattern of strongPatterns) {
      if (pattern.test(text)) {
        return 0.95;
      }
    }

    // Medium confidence triggers
    const mediumPatterns = [
      /\b(cloud run|nginx|docker|port 3000|turso|sqlite|gateway|session|token)\b/i,
      /\bwhat is the architecture\b/i,
      /\bhow does .* work\b/i,
    ];

    for (const pattern of mediumPatterns) {
      if (pattern.test(text)) {
        return 0.75;
      }
    }

    return 0.1;
  }

  public async execute(input: AgentInput, orchestrator?: IAgentOrchestrator): Promise<AgentOutput> {
    const startTime = Date.now();
    this.logger.info(`[KnowledgeAgent] Processing knowledge task for user ${input.userId}: "${input.message}"`);

    try {
      // Check if multi-step delegation is needed (e.g., query also requests live tool execution or trainer stats)
      const needsToolDelegation = /\b(trainer|fans|stats|leaderboard|pure db|factor)\b/i.test(input.message) &&
        orchestrator &&
        (!input.delegationChain || !input.delegationChain.includes('tool-agent'));

      let delegatedResult: AgentOutput | undefined;
      if (needsToolDelegation && orchestrator) {
        this.logger.info(`[KnowledgeAgent] Delegating domain subtask to ToolAgent`);
        delegatedResult = await orchestrator.delegate(this.id, 'tool-agent', input);
      }

      // Execute grounded reasoning with ToolCallingAgent
      const context = input.context
        ? `${input.context}\n${delegatedResult ? `\n[Tool Delegation Context]: ${delegatedResult.answer}` : ''}`
        : delegatedResult ? `[Tool Delegation Context]: ${delegatedResult.answer}` : undefined;

      const { answer, toolsUsed } = await this.runToolCallingAgent(
        { ...input, context },
        {
          systemPromptPrefix: KNOWLEDGE_AGENT_SYSTEM_PROMPT,
          domainGuard: false,
          maxToolCalls: 8,
          toolTimeoutMs: 10_000,
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
        retrievalsCount: toolsUsed.filter(t => t.includes('knowledge') || t.includes('document')).length,
        durationMs,
        delegations: delegatedResult ? [
          {
            fromAgentId: this.id,
            toAgentId: 'tool-agent',
            task: input.message,
            durationMs: delegatedResult.durationMs,
            success: delegatedResult.status === 'completed',
            toolsUsed: delegatedResult.toolsUsed,
          }
        ] : undefined,
      };
    } catch (err: any) {
      this.logger.error(`[KnowledgeAgent] Execution failed: ${err?.message ?? err}`);
      return {
        agentId: this.id,
        agentName: this.name,
        answer: 'I encountered an issue retrieving the requested project documentation.',
        status: 'failed',
        toolsUsed: [],
        durationMs: Date.now() - startTime,
        error: err?.message ?? String(err),
      };
    }
  }
}
