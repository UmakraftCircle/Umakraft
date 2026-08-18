import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from '@ai-agent-platform/core';
import { buildAIService } from './bootstrap.js';
import { ToolCallingAgent } from '@ai-agent-platform/core';
import { conversationMemoryStore } from '@ai-agent-platform/integrations';
import { askTools } from './ask-tools.js';

const logger = createLogger('AskHandler');

let registered = false;

/** Register read-only /ask tools into the shared registry exactly once. */
export function ensureAskToolsRegistered(): void {
  if (registered) return;
  const registry = ToolRegistry.getInstance();
  for (const tool of askTools) {
    registry.register(tool);
  }
  registered = true;
  logger.info(`Registered ${askTools.length} read-only /ask tools`);
}

/** Feature 1+2: handle the /ask slash command with a model-driven tool loop. */
export async function handleAsk(interaction: ChatInputCommandInteraction): Promise<void> {
  const question = interaction.options.getString('question', true).trim();
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  await interaction.deferReply();

  try {
    ensureAskToolsRegistered();

    // Feature 1: retrieve short-term conversation context.
    const history = await conversationMemoryStore.recent(userId, channelId, 10);
    const context = history.length
      ? history.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n')
      : undefined;

    // Build an AI service from env (honours AI_PROVIDER=local|groq|openai|anthropic).
    const aiService = buildAIService();

    const agent = new ToolCallingAgent(aiService, ToolRegistry.getInstance());
    const answer = await agent.run(userId, question, context, {
      maxToolCalls: 4,
      toolTimeoutMs: 8_000,
      generateTimeoutMs: 20_000,
      overallTimeoutMs: 90_000,
    });

    // Feature 1: persist the exchange for future context.
    await conversationMemoryStore.append({ userId, channelId, role: 'user', content: question });
    await conversationMemoryStore.append({ userId, channelId, role: 'assistant', content: answer });

    await interaction.editReply(answer);
  } catch (err: any) {
    logger.error(`/ask error: ${err?.message ?? err}`);
    await interaction.editReply('Sorry, something went wrong while answering. Please try again.');
  }
}

export const askCommand = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask the AI agent a question (uses tools + context)')
  .addStringOption((opt) =>
    opt.setName('question').setDescription('Your question').setRequired(true)
  )
  .setDMPermission(false)
  .toJSON();
