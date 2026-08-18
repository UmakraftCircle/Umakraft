import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry, AgentRunner, ToolCallingAgent } from '@ai-agent-platform/core';
import { buildAIService } from './bootstrap.js';
import { taskStateStore } from '@ai-agent-platform/integrations';
import { ensureAskToolsRegistered } from './ask.js';

const logger = createLogger('AgentHandler');

/**
 * Feature 4: `/agent` — the multi-step planning & execution entry point.
 * Uses AgentRunner (Planner + TaskManager) with deferred reply so Discord
 * never hangs. Falls back to the conversational ToolCallingAgent on timeout.
 */
export async function handleAgent(interaction: ChatInputCommandInteraction): Promise<void> {
  const goal = interaction.options.getString('goal', true).trim();
  const userId = interaction.user.id;
  const guildId = interaction.guildId ?? null;
  const channelId = interaction.channelId;

  await interaction.deferReply();

  try {
    ensureAskToolsRegistered();

    const aiService = buildAIService();

    const registry = ToolRegistry.getInstance();
    const runner = new AgentRunner(aiService, registry, taskStateStore);

    const result = await runner.run(userId, goal, { guildId, channelId });

    if (result.status === 'completed') {
      await interaction.editReply(result.answer);
    } else if (result.status === 'timeout' || result.status === 'failed') {
      // Fall back to a single conversational answer so the user still gets something.
      const agent = new ToolCallingAgent(aiService, registry);
      const answer = await agent.run(userId, goal, undefined, {
        maxToolCalls: 4,
        toolTimeoutMs: 8_000,
        generateTimeoutMs: 20_000,
        overallTimeoutMs: 90_000,
      });
      await interaction.editReply(
        `${answer}\n\n*(${result.status}: ${result.errors.slice(0, 2).join('; ') || 'hit limits'})*`
      );
    } else {
      await interaction.editReply('This task was cancelled.');
    }
  } catch (err: any) {
    logger.error(`/agent error: ${err?.message ?? err}`);
    await interaction.editReply('Sorry, something went wrong while planning that task.');
  }
}

export const agentCommand = new SlashCommandBuilder()
  .setName('agent')
  .setDescription('Run a multi-step task using planning + tools')
  .addStringOption((opt) =>
    opt.setName('goal').setDescription('What do you want to accomplish?').setRequired(true)
  )
  .setDMPermission(false)
  .toJSON();
