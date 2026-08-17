import { Client, GatewayIntentBits, REST, Routes, Events, Interaction, TextChannel } from 'discord.js';
import { createLogger, PLATFORM_NAME } from '@ai-agent-platform/shared';
import { toolRegistry } from '@ai-agent-platform/core';
import { GreetingService, DailyMessageService, MilestoneMessageService, MonthlyAchievementService, ReminderMessageService, DailyAchievementService, promptLibrary, createProvider, MockAIService, type AIService } from '@ai-agent-platform/ai';
import type { TimeSlot, MilestoneInfo, MonthlyTier, TrainerGap, DailyAchiever, MonthlyAchiever } from '@ai-agent-platform/ai';
import { detectNewMilestone, detectMonthlyAchievement } from '@ai-agent-platform/ai';
import cron from 'node-cron';
import * as readline from 'readline';

// Import all platform tools
import { allTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools as fanTrackerTools, fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { MessageSupervisor } from './supervisor.js';
import { allDomainTools as prMonitorTools } from '@ai-agent-platform/pr-monitor';

// Discord slash commands
import { ALL_COMMANDS } from './commands.js';
import { routeCommand, handleTrainerAutocomplete } from './handlers.js';

const logger = createLogger('Discord-Bot');

// ── Bootstrap tool registry ──

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

// ── Real Gateway Mode ──

async function startGatewayBot() {
  const token = process.env['DISCORD_BOT_TOKEN']!;
  const clientId = process.env['DISCORD_CLIENT_ID']!;

  // Validate token format — Discord tokens are ~70 chars, base64-like
  if (!token || token.length < 50) {
    logger.error('DISCORD_BOT_TOKEN appears invalid (too short or missing). Aborting Gateway mode.');
    return;
  }
  if (!clientId || clientId.length < 15) {
    logger.error('DISCORD_CLIENT_ID appears invalid. Aborting Gateway mode.');
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
  });

  // Feature 1 — provider-agnostic conversational AI for /ask (falls back to Mock in dev).
  const askGroqKey = process.env['GROQ_API_KEY'];
  const aiService: AIService = askGroqKey
    ? createProvider('groq', askGroqKey, process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile')
    : new MockAIService('mock-conversational');

  // ── Register slash commands on ready ──
  client.on(Events.ClientReady, async () => {
    logger.info(`Logged in as ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      logger.info(`Registering ${ALL_COMMANDS.length} slash commands...`);

      // Register globally (can also register per-guild during dev)
      const guildId = process.env['DISCORD_GUILD_ID'];
      if (guildId) {
        // Guild-specific: instant updates (good for development)
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: ALL_COMMANDS,
        });
        logger.info(`Registered ${ALL_COMMANDS.length} slash commands to guild ${guildId}.`);
      } else {
        // Global: takes up to 1 hour to propagate (production)
        await rest.put(Routes.applicationCommands(clientId), {
          body: ALL_COMMANDS,
        });
        logger.info(`Registered ${ALL_COMMANDS.length} slash commands globally.`);
      }
    } catch (err: any) {
      logger.error(`Failed to register slash commands: ${err.message}`);
    }
  });

  // ── Handle interactions ──
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (interaction.isAutocomplete()) {
      await handleTrainerAutocomplete(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      await routeCommand(interaction, aiService);
      return;
    }
  });

  // ── New Member Greeting ──
  const groqKey = process.env['GROQ_API_KEY'];