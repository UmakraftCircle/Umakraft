import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry, AgentRunner, ToolCallingAgent } from '@ai-agent-platform/core';
import { buildAIService } from './bootstrap.js';
import { taskStateStore } from '@ai-agent-platform/integrations';
import { ensureAskToolsRegistered } from './ask.js';
import { allSkillTools } from '@ai-agent-platform/skills';
import { failureMessage } from './errors.js';

const logger = createLogger('AgentHandler');

/**
 * Feature 4: `/agent` — the multi-step planning & execution entry point.
 * Uses AgentRunner (Planner + TaskManager) with deferred reply so Discord
 * never hangs. Falls back to the conversational ToolCallingAgent on timeout.
 *
 * Scope: general goal execution, subject to safety. The Planner uses its own
 * domain-agnostic prompt, and the fallback agent runs with `domainGuard: false`,
 * so `/agent` is NOT restricted to Uma Musume (unlike `/ask`).
 *
 * Registers the read-only `/ask` tools (via ensureAskToolsRegistered) plus the
 * full skill toolset (allSkillTools), so a plan can reach for any skill.
 */

/** Register the skill tools into the shared registry exactly once. */
let skillsRegistered = false;
function ensureSkillToolsRegistered(): void {
  if (skillsRegistered) return;
  const registry = ToolRegistry.getInstance();
  for (const tool of allSkillTools) {
    registry.register(tool);
  }
  skillsRegistered = true;
  logger.info(`Registered ${allSkillTools.length} skill tools for /agent`);
}

export async function handleAgent(interaction: ChatInputCommandInteraction): Promise<void> {
  const goal = interaction.options.getString('goal', true).trim();
  const userId = interaction.user.id;
  const guildId = interaction.guildId ?? null;
  const channelId = interaction.channelId;

  await interaction.deferReply();

  try {
    ensureAskToolsRegistered();
    ensureSkillToolsRegistered();

    const aiService = buildAIService();

    const registry = ToolRegistry.getInstance();
    const runner = new AgentRunner(aiService, registry, taskStateStore);

    const result = await runner.run(userId, goal, { guildId, channelId });

    if (result.status === 'completed') {
      await interaction.editReply(result.answer);
    } else if (result.status === 'timeout' || result.status === 'failed') {
      // Fall back to a single conversational answer so the user still gets something.
      // domainGuard is OFF — this is general conversation, not Uma-only.
      const agent = new ToolCallingAgent(aiService, registry);
      const answer = await agent.run(userId, goal, undefined, {
        maxToolCalls: 4,
        toolTimeoutMs: 8_000,
        generateTimeoutMs: 20_000,
        overallTimeoutMs: 90_000,
        domainGuard: false,
      });
      await interaction.editReply(
        `${answer}\n\n*(${result.status}: ${result.errors.slice(0, 2).join('; ') || 'hit limits'})*`
      );
    } else {
      await interaction.editReply('This task was cancelled.');
    }
  } catch (err: any) {
    logger.error(`/agent error: ${err?.message ?? err}`);
    await interaction.editReply(failureMessage(err));
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
