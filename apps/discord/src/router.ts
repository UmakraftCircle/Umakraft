import { createLogger } from '@ai-agent-platform/shared';
import type { AIService } from '@ai-agent-platform/ai';
import {
  AgentOrchestrator,
  type AgentInput,
  type AgentOutput,
  type AgentRoutingDecision,
  ToolRegistry,
} from '@ai-agent-platform/core';
import { buildAIService } from './bootstrap.js';

const logger = createLogger('Router');

export type IntentRoute = 'ask' | 'chat';

export interface RouteDecision {
  route: IntentRoute;
  confidence?: number;
  rawOutput?: string;
  selectedAgentId?: string;
}

export const ROUTER_CLASSIFIER_PROMPT = `You are a routing classifier.

Determine whether the user message is:
ask
chat

Rules:

ask:
- factual questions
- explanations
- information requests
- troubleshooting
- research

chat:
- casual conversation
- greetings
- social interaction
- emotional discussion
- roleplay

Return only:
ask
or
chat`;

export interface ClassifyIntentOptions {
  userId?: string;
  message: string;
  aiService?: AIService;
}

let sharedOrchestrator: AgentOrchestrator | null = null;

/**
 * Returns or initializes the shared multi-agent orchestrator.
 */
export function getOrchestrator(aiService?: AIService): AgentOrchestrator {
  const service = aiService ?? buildAIService();
  if (!sharedOrchestrator) {
    sharedOrchestrator = new AgentOrchestrator({
      aiService: service,
      registry: ToolRegistry.getInstance(),
    });
  }
  return sharedOrchestrator;
}

/**
 * Routes and executes an input across the multi-agent system (Phase 9).
 */
export async function routeMultiAgent(
  input: AgentInput,
  aiService?: AIService
): Promise<AgentOutput> {
  const orchestrator = getOrchestrator(aiService);
  return orchestrator.routeAndExecute(input);
}

/**
 * Lightweight LLM-based intent classifier for Phase 3.
 *
 * Rules:
 * - Strictly avoids keyword heuristics, regex checks, or question-mark detection.
 * - Restricts classification to 'ask' or 'chat'.
 * - If uncertain or upon any generation error, safely defaults to 'chat'.
 * - Logs lightweight route decisions with user ID.
 */
export async function classifyIntent(options: ClassifyIntentOptions): Promise<RouteDecision> {
  const { userId = 'unknown', message, aiService } = options;
  const trimmed = (message || '').trim();

  // Guard: Empty messages safely default to casual chat
  if (!trimmed) {
    logger.info(`[Router] User ID: ${userId} | Decision: chat | Confidence: 1.0 (empty message)`);
    return { route: 'chat', confidence: 1.0, rawOutput: 'empty' };
  }

  try {
    const service = aiService ?? buildAIService();
    const prompt = `${ROUTER_CLASSIFIER_PROMPT}\n\nUser:\n${trimmed}`;

    const raw = await service.generate({
      prompt,
      maxTokens: 12,
    });

    const normalized = (raw || '').trim().toLowerCase();

    let decidedRoute: IntentRoute = 'chat';
    let confidence = 0.95;

    // Direct classification matching from LLM
    if (normalized === 'ask' || (normalized.startsWith('ask') && !normalized.includes('chat'))) {
      decidedRoute = 'ask';
    } else if (normalized === 'chat' || (normalized.startsWith('chat') && !normalized.includes('ask'))) {
      decidedRoute = 'chat';
    } else {
      // Check if output is a JSON payload like {"route": "ask"}
      try {
        const parsed = JSON.parse(raw);
        if (parsed.route === 'ask' || parsed.route === 'chat') {
          decidedRoute = parsed.route;
        } else {
          // Unclear JSON: default to chat
          decidedRoute = 'chat';
          confidence = 0.5;
        }
      } catch {
        // Ambiguous or unrecognized LLM output: default to chat
        decidedRoute = 'chat';
        confidence = 0.5;
      }
    }

    logger.info(`[Router] User ID: ${userId} | Route: ${decidedRoute} | Decision: ${decidedRoute} | Confidence: ${confidence}`);
    return {
      route: decidedRoute,
      confidence,
      rawOutput: raw,
    };
  } catch (err: any) {
    logger.warn(`[Router] User ID: ${userId} | Classification failed: ${err?.message ?? err}; falling back to chat`);
    return {
      route: 'chat',
      confidence: 0.5,
      rawOutput: err?.message,
    };
  }
}
