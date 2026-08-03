import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  type APIApplicationCommand,
} from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import {
  fanTrackerAPI,
  type TrainerStats,
  type RankThreshold,
} from '@ai-agent-platform/fan-tracker';
import {
  registerTools,
  type AIService,
  type ToolRegistry,
} from '@ai-agent-platform/ai';
import { createBotAIService } from '../ai.js';
import { MonthlyAchievementScheduler } from '../scheduler.js';
import {
  buildFanGainEmbed,
  buildFanLeaderboardEmbed,
  buildFanTrendEmbed,
  handleTrainerAutocomplete,
  routeCommand,
} from './handlers.js';
import { TrainerLinkStore } from './trainer-link-store.js';
import { DiscordUserService } from './discord-user-service.js';
import { DailyAchievementScheduler } from './daily-achievement-scheduler.js';

export type { DiscordUserService } from './discord-user-service.js';
export { TrainerLinkStore } from './trainer-link-store.js';
export { DailyAchievementScheduler } from './daily-achievement-scheduler.js';

const logger = createLogger('DiscordBot');

// ── Command Registration ─────────────────────────────────

const GUILD_ID = '1489093959044173935';

const COMMANDS = [
  new SlashCommandBuilder()
    .setName('fan')
    .setDescription('Fan tracker commands')
    .addSubcommand(s =>
      s.setName('gain')
        .setDescription('Show fan gain stats')
        .addStringOption(o =>
          o.setName('trainer')
            .setDescription('Trainer name (autocomplete)')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(s =>
      s.setName('leaderboard')
        .setDescription('Show monthly leaderboard'))
    .addSubcommand(s =>
      s.setName('trend')
        .setDescription('Analyze fan growth trends')
        .addStringOption(o =>
          o.setName('trainer')
            .setDescription('Trainer name (autocomplete)')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(o =>
          o.setName('period')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' },
              { name: 'Monthly', value: 'monthly' },
            )))
    .addSubcommand(s =>
      s.setName('link')
        .setDescription('Link your trainer account')
        .addStringOption(o =>
          o.setName('trainer')
            .setDescription('Trainer name (autocomplete)')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(s =>
      s.setName('unlink')
        .setDescription('Unlink your trainer account'))
    .addSubcommand(s =>
      s.setName('whois')
        .setDescription("Check someone's linked trainer")
        .addUserOption(o =>
          o.setName('user')
            .setDescription('Discord user')
            .setRequired(false)))
    .addSubcommand(s =>
      s.setName('rankings')
        .setDescription('Show tier rank thresholds')),
];

export async function registerSlashCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    logger.info('Registering guild slash commands...');
    const body = COMMANDS.map(c => c.toJSON());

    const registered = await rest.put(
      Routes.applicationGuildCommands(clientId, GUILD_ID),
      { body },
    ) as APIApplicationCommand[];

    logger.info(`✓ Registered ${registered.length} guild slash commands`);
  } catch (error: any) {
    logger.error(`Failed to register commands: ${error.message}`);
    throw error;
  }
}

// ── Client Factory ───────────────────────────────────────

export function createDiscordClient(
  token: string,
  _tools: ToolRegistry,
  aiService: AIService,
  discordUserService: DiscordUserService,
): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const trainerLinkStore = new TrainerLinkStore();
  
  // Start the monthly achievement scheduler (no progression check, just milestone)
  let monthlyScheduler: MonthlyAchievementScheduler | null = null;
  
  // Start the daily top-10 achievement scheduler (8 PM Manila)
  let dailyScheduler: DailyAchievementScheduler | null = null;

  client.once('ready', async (readyClient) => {
    const tag = readyClient.user?.tag ?? 'unknown';
    logger.info(`Logged in as ${tag}`);

    try {
      // Register slash commands at startup
      if (readyClient.user?.id) {
        await registerSlashCommands(token, readyClient.user.id);
      }

      // Start the monthly achievement scheduler
      const botAI = createBotAIService();
      monthlyScheduler = new MonthlyAchievementScheduler(
        fanTrackerAPI,
        trainerLinkStore,
        discordUserService,
        botAI,
        readyClient,
      );
      monthlyScheduler.start();
      logger.info('Monthly achievement scheduler started');

      // Start the daily top-10 achievement scheduler
      const dailyAI = createBotAIService();
      dailyScheduler = new DailyAchievementScheduler(
        fanTrackerAPI,
        trainerLinkStore,
        discordUserService,
        dailyAI,
        readyClient,
      );
      dailyScheduler.start();
      logger.info('Daily achievement scheduler started');
    } catch (err: any) {
      logger.error(`Failed to start schedulers: ${err.message}`);
    }
  });

  // ── Interaction Handler ────────────────────────────────

  client.on('interactionCreate', async (interaction) => {
    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused(true);
      if (focused.name === 'trainer') {
        await handleTrainerAutocomplete(interaction, focused.value, fanTrackerAPI);
      }
      return;
    }

    // Only handle chat input commands below
    if (!interaction.isChatInputCommand()) return;

    try {
      await handleCommand(interaction, fanTrackerAPI, trainerLinkStore, discordUserService, aiService);
    } catch (error: any) {
      logger.error(`Command error: ${error.message}`);
      const reply = { content: '❌ An error occurred.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  });

  client.login(token).catch(err => {
    logger.error(`Failed to login: ${err.message}`);
    process.exit(1);
  });

  return client;
}

// ── Command Router ───────────────────────────────────────

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  api: typeof fanTrackerAPI,
  trainerLinkStore: TrainerLinkStore,
  discordUserService: DiscordUserService,
  aiService: AIService,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  // Delegate to handlers.ts module
  await routeCommand(interaction, api, trainerLinkStore, discordUserService, aiService);
}

export { buildFanGainEmbed, buildFanLeaderboardEmbed, buildFanTrendEmbed } from './handlers.js';
export { handleTrainerAutocomplete } from './handlers.js';
export type { AIService } from '@ai-agent-platform/ai';
