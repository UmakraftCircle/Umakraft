import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from '@ai-agent-platform/ai';
import type { IAgent, AgentInput, AgentRoutingDecision } from './types.js';

const logger = createLogger('RouterAgent');

export const ROUTER_AGENT_CLASSIFIER_PROMPT = `You are an intelligent Multi-Agent Routing Classifier.

Analyze the user's message and select the most appropriate specialized agent:

1. knowledge-agent:
   - Project documentation, architecture, deployment, Cloud Run, Nginx, specs, RAG queries, or summarizing project documents.
2. memory-agent:
   - Past conversation history, summarizing what was discussed, remembering user facts, profile preferences.
3. tool-agent:
   - Live trainer statistics, leaderboards, fan counts, web search, pure DB queries, or multi-step execution.
4. moderation-agent:
   - Moderation reviews, safety checks, policy audits, toxicity/harassment reports.
5. chat:
   - General conversation, friendly chat, greetings, roleplay, casual talk.

Return your response in JSON format:
{
  "selectedAgentId": "knowledge-agent" | "memory-agent" | "tool-agent" | "moderation-agent" | "chat",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

export class RouterAgent {
  public readonly id = 'router-agent';
  public readonly name = 'Router Agent';
  public readonly description = 'Analyzes message intent, scores candidate agents, and routes tasks to the best specialized agent with fallback recovery.';

  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  public async classify(
    input: AgentInput,
    candidates: IAgent[]
  ): Promise<AgentRoutingDecision> {
    const startTime = Date.now();
    const candidateScores: Record<string, number> = {};

    // 1. Gather confidence scores from all registered candidates
    for (const candidate of candidates) {
      try {
        const score = await candidate.canHandle(input);
        candidateScores[candidate.id] = score;
      } catch (err) {
        candidateScores[candidate.id] = 0;
      }
    }

    // Find highest scoring candidate
    let bestAgentId = '';
    let highestScore = 0;
    for (const [id, score] of Object.entries(candidateScores)) {
      if (score > highestScore) {
        highestScore = score;
        bestAgentId = id;
      }
    }

    // If a candidate clearly matches (score >= 0.75), route directly
    if (highestScore >= 0.75 && bestAgentId) {
      const decision: AgentRoutingDecision = {
        selectedAgentId: bestAgentId,
        confidence: highestScore,
        reasoning: `Matched high confidence score (${highestScore.toFixed(2)}) from ${bestAgentId}`,
        candidateScores,
        isFallback: false,
        intent: this.mapAgentIdToIntent(bestAgentId),
      };

      logger.info(
        `[RouterAgent] Direct match for user ${input.userId}: ${bestAgentId} (confidence: ${highestScore.toFixed(2)}, duration: ${Date.now() - startTime}ms)`
      );
      return decision;
    }

    // 2. Ambiguous or medium score: use LLM classifier for semantic intent classification
    try {
      const prompt = `${ROUTER_AGENT_CLASSIFIER_PROMPT}\n\nUser Message:\n"${input.message}"`;
      const raw = await this.aiService.generate({
        prompt,
        maxTokens: 120,
      });

      let parsed: { selectedAgentId?: string; confidence?: number; reasoning?: string } = {};
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // parsing fallback
      }

      let selectedId = parsed.selectedAgentId || bestAgentId || 'chat';
      let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;
      let reasoning = parsed.reasoning || `LLM classified as ${selectedId}`;

      // If selected ID is 'chat' or unrecognized, fall back gracefully
      if (selectedId === 'chat' || !candidates.some(c => c.id === selectedId)) {
        selectedId = bestAgentId && highestScore >= 0.5 ? bestAgentId : 'chat';
      }

      const decision: AgentRoutingDecision = {
        selectedAgentId: selectedId,
        confidence,
        reasoning,
        candidateScores,
        isFallback: selectedId === 'chat' && highestScore < 0.4,
        intent: this.mapAgentIdToIntent(selectedId),
      };

      logger.info(
        `[RouterAgent] LLM routing decision for user ${input.userId}: ${selectedId} (confidence: ${confidence.toFixed(2)}, reasoning: "${reasoning}", duration: ${Date.now() - startTime}ms)`
      );
      return decision;
    } catch (err: any) {
      // 3. Fallback recovery on any LLM or network failure
      const fallbackId = bestAgentId && highestScore >= 0.5 ? bestAgentId : 'chat';
      logger.warn(
        `[RouterAgent] Classification error: ${err?.message ?? err}; falling back to ${fallbackId}`
      );

      return {
        selectedAgentId: fallbackId,
        confidence: 0.5,
        reasoning: `Fallback triggered due to error: ${err?.message ?? err}`,
        candidateScores,
        isFallback: true,
        intent: this.mapAgentIdToIntent(fallbackId),
      };
    }
  }

  private mapAgentIdToIntent(
    agentId: string
  ): 'knowledge' | 'memory' | 'tool' | 'moderation' | 'chat' | 'ask' {
    switch (agentId) {
      case 'knowledge-agent':
        return 'knowledge';
      case 'memory-agent':
        return 'memory';
      case 'tool-agent':
        return 'tool';
      case 'moderation-agent':
        return 'moderation';
      default:
        return 'chat';
    }
  }
}
