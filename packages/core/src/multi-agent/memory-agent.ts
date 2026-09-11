import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput, IAgentOrchestrator } from './types.js';

export const MEMORY_AGENT_SYSTEM_PROMPT = `You are the specialized Memory & Conversation History Agent for the Umakraft platform.
Your objective is to recall user preferences, summarize past discussions, inspect user profile facts, and store long-term memory.

Operating Guidelines:
1. When asked what we talked about or to summarize conversations, invoke summarize_conversation or get_conversation_history.
2. When asked about user facts or preferences, invoke get_user_profile.
3. When the user tells you to remember something or updates their details, invoke save_user_fact.
4. Maintain a polite, attentive, and helpful tone.`;

export class MemoryAgent extends BaseAgent {
  public readonly id = 'memory-agent';
  public readonly name = 'Memory Agent';
  public readonly description = 'Retrieves past conversation turns, summarizes previous dialogues, inspects user profiles, and persists long-term facts.';
  public readonly allowedTools = [
    'get_conversation_history',
    'summarize_conversation',
    'get_user_profile',
    'save_user_fact',
  ];

  public async canHandle(input: AgentInput): Promise<number> {
    const text = input.message.toLowerCase();

    // High confidence triggers
    const strongPatterns = [
      /\b(summarize|summary of)\b.*\b(conversation|dialogue|chat|messages?|history|discussion)\b/i,
      /\bwhat did (we|i) (talk|speak|discuss|say)\b/i,
      /\b(remember|recall|forget)\b/i,
      /\bwhat is my (name|favorite|trainer|fact|profile)\b/i,
      /\b(my profile|my memory|saved facts|my preferences)\b/i,
      /\bdo you remember\b/i,
    ];

    for (const pattern of strongPatterns) {
      if (pattern.test(text)) {
        return 0.95;
      }
    }

    // Medium confidence triggers
    const mediumPatterns = [
      /\b(history|memories|profile|facts)\b/i,
      /\bwho am i\b/i,
    ];

    for (const pattern of mediumPatterns) {
      if (pattern.test(text)) {
        return 0.70;
      }
    }

    return 0.1;
  }

  public async execute(input: AgentInput, orchestrator?: IAgentOrchestrator): Promise<AgentOutput> {
    const startTime = Date.now();
    this.logger.info(`[MemoryAgent] Processing memory task for user ${input.userId}: "${input.message}"`);

    try {
      const { answer, toolsUsed } = await this.runToolCallingAgent(
        input,
        {
          systemPromptPrefix: MEMORY_AGENT_SYSTEM_PROMPT,
          domainGuard: false,
          maxToolCalls: 6,
          toolTimeoutMs: 10_000,
        }
      );

      const durationMs = Date.now() - startTime;

      return {
        agentId: this.id,
        agentName: this.name,
        answer,
        status: 'completed',
        toolsUsed,
        durationMs,
      };
    } catch (err: any) {
      this.logger.error(`[MemoryAgent] Execution failed: ${err?.message ?? err}`);
      return {
        agentId: this.id,
        agentName: this.name,
        answer: 'I encountered an issue accessing your conversation memory.',
        status: 'failed',
        toolsUsed: [],
        durationMs: Date.now() - startTime,
        error: err?.message ?? String(err),
      };
    }
  }
}
