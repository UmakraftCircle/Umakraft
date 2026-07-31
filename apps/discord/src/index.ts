import { Client, GatewayIntentBits, REST, Routes, Events, Interaction } from 'discord.js';
import { createLogger, PLATFORM_NAME } from '@ai-agent-platform/shared';
import { toolRegistry } from '@ai-agent-platform/core';
import * as readline from 'readline';

// Import all platform tools
import { allTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools as fanTrackerTools } from '@ai-agent-platform/fan-tracker';
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

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
  });

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
      await routeCommand(interaction);
      return;
    }
  });

  await client.login(token);
}

// ── CLI Simulator Mode ──

function startSimulator() {
  logger.warn('No DISCORD_BOT_TOKEN detected!');
  logger.info('Booting in interactive CLI SIMULATOR mode.');
  logger.info('');
  logger.info('Available commands (simulated):');
  logger.info('  /sync                          — refresh cache');
  logger.info('  /fans gain [daily|weekly|monthly]  — fan gain');
  logger.info('  /fans leaderboard [10|15|20|30] [daily|weekly|monthly]');
  logger.info('  /link add <user> <trainer-id>  — link user');
  logger.info('  /link remove <user>            — unlink user');
  logger.info('  /link list                     — show links');
  logger.info('  !agent <prompt>                — run full agent pipeline');
  logger.info('  exit                           — quit');
  logger.info('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question('\x1b[36m[Discord #general-chat]>\x1b[0m ', async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === 'exit') {
        rl.close();
        logger.info('Simulator stopped.');
        process.exit(0);
      }

      if (trimmed.startsWith('!agent ')) {
        await runAgentPipeline(trimmed.replace('!agent ', ''));
      } else if (trimmed.startsWith('/')) {
        console.log('\x1b[33m[Simulator]\x1b[0m Slash commands require a real Discord connection.');
        console.log('  Set DISCORD_BOT_TOKEN + DISCORD_CLIENT_ID to enable full Gateway mode.\n');
      } else if (trimmed !== '') {
        console.log('\x1b[90m[System] Message sent (use !agent or /command)\x1b[0m\n');
      }

      promptUser();
    });
  };

  promptUser();
}

// ── Agent pipeline (kept for !agent prefix in simulator) ──

async function runAgentPipeline(prompt: string) {
  const { Planner, TaskManager } = await import('@ai-agent-platform/core');
  const { MockAIService } = await import('@ai-agent-platform/ai');

  const ai = new MockAIService('claude-3-5-sonnet');
  const planner = new Planner(ai, toolRegistry);
  const taskManager = new TaskManager(toolRegistry);

  console.log(`\n⏳ Planning for: "${prompt}"...`);
  const plan = await planner.plan(prompt);

  console.log(`📋 Plan generated: ${plan.tasks.size} steps`);
  for (const task of plan.tasks.values()) {
    const deps = task.dependencies.length > 0 ? ` (after ${task.dependencies.join(', ')})` : '';
    console.log(`  [${task.id}] ${task.name} via ${task.toolSlug}${deps}`);
  }

  console.log('🚀 Executing...');
  const result = await taskManager.executePlan(plan);

  let ok = 0, fail = 0;
  for (const task of result.tasks.values()) {
    if (task.status === 'completed') ok++;
    else fail++;
    console.log(`  [${task.id}] ${task.status}: ${task.result ? JSON.stringify(task.result).slice(0, 80) : task.error}`);
  }

  console.log(`\n✅ ${ok}/${result.tasks.size} tasks succeeded.\n`);
}

// ── Entry point ──

async function startBot() {
  const token = process.env['DISCORD_BOT_TOKEN'];
  const clientId = process.env['DISCORD_CLIENT_ID'];
  const umaKey = process.env['UMAMOE_API_KEY'];
  const circleId = process.env['UMAMOE_CIRCLE_ID'] || '974470619';

  logger.info('='.repeat(50));
  logger.info(`Starting ${PLATFORM_NAME} Discord Service...`);
  logger.info('='.repeat(50));
  logger.info(`uma.moe API: ${umaKey ? '✅ key configured' : '⚠️ no key — may hit rate limits'}`);
  logger.info(`Circle ID: ${circleId}`);

  if (token && clientId) {
    await startGatewayBot();
  } else {
    if (token && !clientId) {
      logger.warn('DISCORD_BOT_TOKEN is set but DISCORD_CLIENT_ID is missing.');
      logger.warn('Both are required for Gateway mode. Falling back to simulator.');
    }
    startSimulator();
  }
}

startBot();
