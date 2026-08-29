import { ToolCallingAgent } from '@ai-agent-platform/core';
import type { ToolRegistry } from '@ai-agent-platform/core';
import type { AIService } from '@ai-agent-platform/ai';

export interface DiscordAgentHandlerOptions {
  trainerName?: string;
  maxWebSearches?: number;
}

export async function handleDiscordAsk(
  ai: AIService,
  registry: ToolRegistry,
  userId: string,
  question: string,
  options: DiscordAgentHandlerOptions = {}
): Promise<{ text: string; usedWebSearch: boolean }> {
  const agent = new ToolCallingAgent(ai, registry);
  const trace = await agent.runWithTrace(userId, question, undefined, {
    maxToolCalls: 4,
    maxWebSearches: options.maxWebSearches ?? 2,
    systemPromptPrefix: options.trainerName
      ? `You are assisting Trainer ${options.trainerName}.`
      : 'You are the Umamusume Discord Bot Assistant.',
  });

  return {
    text: trace.answer,
    usedWebSearch: trace.usedWebSearch,
  };
}
