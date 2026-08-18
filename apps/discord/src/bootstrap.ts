import { createLogger } from '@ai-agent-platform/shared';
import { toolRegistry } from '@ai-agent-platform/core';
import { allTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools as fanTrackerTools } from '@ai-agent-platform/fan-tracker';
import { allDomainTools as prMonitorTools } from '@ai-agent-platform/pr-monitor';
import { createProvider, type AIService } from '@ai-agent-platform/ai';

export const logger = createLogger('Discord-Bot');

/**
 * Build the AI service used by `/ask` and `/agent` from env.
 *
 * Groq is the main provider. Provider selection is explicit and env-driven:
 *    - AI_PROVIDER=local     → the on-host Qwen brain (no API key needed)
 *    - AI_PROVIDER=openai    → OpenAI, using OPENAI_API_KEY
 *    - AI_PROVIDER=anthropic → Anthropic, using ANTHROPIC_API_KEY
 *    - otherwise (default)   → Groq, using GROQ_API_KEY
 *
 * Groq is ALWAYS the fallback when AI_PROVIDER is unset or unrecognised.
 * `createProvider` throws a clear error if the selected provider has no key
 * (the caller surfaces it), so there is no silent mock fallback.
 */
export function buildAIService(): AIService {
  const provider = (process.env['AI_PROVIDER'] || 'groq').toLowerCase();

  if (provider === 'local') {
    return createProvider('local', '');
  }
  if (provider === 'openai') {
    return createProvider('openai', process.env['OPENAI_API_KEY'] || '');
  }
  if (provider === 'anthropic') {
    return createProvider('anthropic', process.env['ANTHROPIC_API_KEY'] || '');
  }

  // Default and unrecognised → Groq (main provider).
  return createProvider('groq', process.env['GROQ_API_KEY'] || '');
}

export function registerAllTools(): void {
  for (const tool of [...allTools]) {
    toolRegistry.register(tool);
  }
  for (const integration of allIntegrations) {
    toolRegistry.register(integration);
  }
  for (const domainTool of [...fanTrackerTools, ...prMonitorTools]) {
    toolRegistry.register(domainTool);
  }

  logger.info(`Registered ${toolRegistry.getDeclarativeSchemas().length} tools in Discord bot.`);
}
