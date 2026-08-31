import { Client, GatewayIntentBits, REST, Routes, Events, Interaction, TextChannel } from 'discord.js';
import { GreetingService, DailyMessageService, MilestoneMessageService, MonthlyAchievementService, ReminderMessageService, DailyAchievementService, promptLibrary, createProvider } from '@ai-agent-platform/ai';
import type { TimeSlot, AIService } from '@ai-agent-platform/ai';
import cron from 'node-cron';
import { MessageSupervisor } from './supervisor.js';
import { ALL_COMMANDS } from './commands.js';
import { routeCommand, handleTrainerAutocomplete, handleCompareAutocomplete } from './handlers.js';
import { wireAutonomy, handleConfirmationButton } from './autonomous.js';
import { ToolRegistry, AgentRunner } from '@ai-agent-platform/core';
import { taskStateStore } from '@ai-agent-platform/integrations';
import { logger } from './bootstrap.js';
import { registerMilestoneJobs } from './milestone-jobs.js';
import { registerReminderJobs } from './reminder-jobs.js';
import { pushRelayMessage } from '../../../relay-inbox.cjs';

export async function startGatewayBot() {
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
      GatewayIntentBits.MessageContent,
    ],
  });

  // ── Phone-agent relay: buffer inbound messages for the phone to poll ──
  // Guard against bot/self messages so the inbox never contains our own echoes.
  client.on(Events.MessageCreate, (message) => {
    if (message.author?.bot) return;
    if (message.author?.id === client.user?.id) return;

    let authorName = 'unknown';
    try { authorName = message.member?.displayName ?? message.author?.username ?? 'unknown'; } catch {}

    pushRelayMessage({
      id: message.id,
      author_id: message.author?.id ?? '',
      author_name: authorName,
      channel_id: message.channelId,
      guild_id: message.guildId ?? null,
      content: message.content ?? '',
      mentions_bot: client.user ? message.mentions.has(client.user.id) : false,
      created_at: message.createdTimestamp ?? Date.now(),
    });
  });

  // ── Register slash commands on ready ──
  client.on(Events.ClientReady, async () => {
    logger.info(`Logged in as ${client.user?.tag}!`);

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      logger.info(`Registering ${ALL_COMMANDS.length} slash commands...`);

      const guildId = process.env['DISCORD_GUILD_ID'];
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: ALL_COMMANDS,
        });
        logger.info(`Registered ${ALL_COMMANDS.length} slash commands to guild ${guildId}.`);
      } else {
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
      const focused = interaction.options.getFocused(true);
      if (focused.name === 'trainer1' || focused.name === 'trainer2') {
        await handleCompareAutocomplete(interaction);
      } else {
        await handleTrainerAutocomplete(interaction);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      await routeCommand(interaction);
      return;
    }
    if (interaction.isButton()) {
      await handleConfirmationButton(interaction, onApproved).catch((err: any) => logger.error(`button error: ${err?.message}`));
      return;
    }
  });

  // ── New Member Greeting ──
  const groqKey = process.env['GROQ_API_KEY'];
  let greetingService: GreetingService;
  let dailyService: DailyMessageService;
  let milestoneService: MilestoneMessageService;
  let monthlyService: MonthlyAchievementService;
  let reminderService: ReminderMessageService;
  let dailyAchievementService: DailyAchievementService;
  const supervisor = new MessageSupervisor();

  // Local brain (supervisor) — the on-host Qwen brain via node-llama-cpp.
  let brainAI: AIService | null = null;
  if (process.env['LOCAL_BRAIN_ENABLED'] === 'true') {
    try {
      brainAI = createProvider('local', '');
      logger.info(`Local brain enabled as supervisor (${brainAI.getCurrentModel()})`);
    } catch (err: any) {
      logger.warn(`Local brain unavailable, supervisor disabled: ${err?.message ?? err}`);
      brainAI = null;
    }
  }

  if (groqKey) {
    const primaryModel = process.env['AI_MODEL'] || process.env['GROQ_MODEL'] || 'llama-3.1-8b-instant';
    const fallbackModel = process.env['AI_FALLBACK_MODEL'] || 'llama-3.3-70b-versatile';
    const primaryAI = createProvider('groq', groqKey, primaryModel);
    const fallbackAI = createProvider('groq', groqKey, fallbackModel);
    greetingService = new GreetingService(primaryAI, promptLibrary, fallbackAI, brainAI);
    dailyService = new DailyMessageService(primaryAI, promptLibrary, fallbackAI, brainAI);
    milestoneService = new MilestoneMessageService(primaryAI, promptLibrary, fallbackAI, brainAI);
    monthlyService = new MonthlyAchievementService(primaryAI, promptLibrary, fallbackAI, brainAI);
    reminderService = new ReminderMessageService(primaryAI, promptLibrary, fallbackAI, brainAI);
    dailyAchievementService = new DailyAchievementService(primaryAI, promptLibrary, fallbackAI, brainAI);
    logger.info('Services initialized: Greeting, Daily, Milestone, Monthly, Reminder, DailyAchievement');
  } else {
    logger.warn('No GROQ_API_KEY set — services in local-brain / cache-only fallback mode.');
    greetingService = new GreetingService(null, promptLibrary, null, brainAI);
    dailyService = new DailyMessageService(null, promptLibrary, null, brainAI);
    milestoneService = new MilestoneMessageService(null, promptLibrary, null, brainAI);
    monthlyService = new MonthlyAchievementService(null, promptLibrary, null, brainAI);
    reminderService = new ReminderMessageService(null, promptLibrary, null, brainAI);
    dailyAchievementService = new DailyAchievementService(null, promptLibrary, null, brainAI);
  }

  logger.info(`MessageSupervisor initialized (60min retry, ${supervisor.pendingCount} pending)`);

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const guild = member.guild;

      const welcomeChannel: TextChannel | undefined =
        (guild.channels.cache.find(
          (c): c is TextChannel =>
            c.isTextBased() && !c.isDMBased() && c.name === 'bot-announcement',
        ) as TextChannel | undefined) ??
        guild.systemChannel ??
        (guild.channels.cache.find(
          (c): c is TextChannel =>
            c.isTextBased() && !c.isDMBased() && c.name !== 'rules',
        ) as TextChannel | undefined);

      if (!welcomeChannel) {
        logger.warn(`No suitable welcome channel found in guild "${guild.name}".`);
        return;
      }

      const greeting = await greetingService.generateGreeting(
        member.user.displayName,
        guild.name,
        guild.memberCount,
      );

      await supervisor.trySend(welcomeChannel, greeting, `greeting:${member.user.tag}`);
      logger.info(`👋 Welcomed ${member.user.tag} in #${welcomeChannel.name} (${guild.name})`);
    } catch (err: any) {
      logger.error(`Failed to send welcome for ${member.user?.tag}: ${err.message}`);
    }
  });

  logger.info(`Registered guildMemberAdd → greeting handler (cached: ${greetingService.getCachedCount()})`);

  // ── Daily Message Cron Jobs ──

  const sendDailyMessage = async (timeSlot: TimeSlot, emoji: string) => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) { logger.warn(`Daily [${timeSlot}]: no guild available.`); return; }

      const channel: TextChannel | undefined =
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased() && c.name === 'bot-announcement',
        ) as TextChannel | undefined) ??
        guild.systemChannel ??
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased(),
        ) as TextChannel | undefined);

      if (!channel) { logger.warn(`Daily [${timeSlot}]: no suitable channel.`); return; }

      const msg = await dailyService.generateDailyMessage(timeSlot, guild.name, guild.memberCount);
      await supervisor.trySend(channel, msg, `daily:${timeSlot}`);

      const pools = dailyService.getAllPoolSizes();
      logger.info(
        `${emoji} Daily [${timeSlot}] sent to #${channel.name} ` +
        `(pools: 🌅${pools.morning} 🌇${pools.noon} 🌆${pools.evening} 🌙${pools.midnight})`,
      );
    } catch (err: any) {
      logger.error(`Daily [${timeSlot}] failed: ${err.message}`);
    }
  };

  const tz = process.env['TZ'] || 'Asia/Manila';

  cron.schedule('0 8 * * *',   () => sendDailyMessage('morning',  '🌞'),  { timezone: tz });
  cron.schedule('0 12 * * *',  () => sendDailyMessage('noon',     '🌇'),  { timezone: tz });
  cron.schedule('0 18 * * *',  () => sendDailyMessage('evening',  '🌆'),  { timezone: tz });
  cron.schedule('0 0 * * *',   () => sendDailyMessage('midnight', '🌙'),  { timezone: tz });

  logger.info(`Daily cron jobs scheduled (${tz}): 🌞 8AM  🌇 12PM  🌆 6PM  🌙 12AM`);

  await registerMilestoneJobs({ client, greetingService, dailyService, milestoneService, monthlyService, reminderService, dailyAchievementService, supervisor });
  registerReminderJobs({ client, greetingService, dailyService, milestoneService, monthlyService, reminderService, dailyAchievementService, supervisor });

  // ── Feature 5: autonomous operation ──
  const onApproved = async (_confirmationId: string) => {
    logger.info('High-risk action approved (execution delegated to ActionController).');
  };
  const runScheduledTask = async (task: any) => {
    try {
      const aiService = createProvider((process.env['AI_PROVIDER'] as any) || 'groq', process.env['GROQ_API_KEY'] || process.env['OPENAI_API_KEY'] || '');
      const runner = new AgentRunner(aiService, ToolRegistry.getInstance(), taskStateStore);
      const goal = task.taskConfig?.target || task.taskConfig?.about || task.taskConfig?.topic || task.taskType;
      await runner.run(task.userId, `Scheduled ${task.taskType}: ${goal}`, { guildId: task.guildId, channelId: task.channelId ?? null });
    } catch (err: any) {
      logger.error(`scheduled task ${task.id} run error: ${err?.message}`);
    }
  };
  wireAutonomy(client, runScheduledTask, onApproved);

  // ── Phone-agent relay: reply IPC from health.cjs ──
  // health.cjs POST /reply then sends {type:'relay-reply', channel_id, content, requestId}
  // to this child process. We perform channel.send on the EXISTING gateway (single
  // connection) and echo the result back via process.send.
  process.on('message', async (m: any) => {
    if (!m || m.type !== 'relay-reply') return;
    const { channel_id, content, requestId } = m;
    try {
      const channel = await client.channels.fetch(channel_id).catch(() => null);
      if (!channel || !(channel as any).isTextBased) {
        (process as any).send?.({ type: 'relay-reply-result', requestId, ok: false, error: 'channel not found or not text-based' });
        return;
      }
      const sent = await (channel as any).send(String(content).slice(0, 2000));
      (process as any).send?.({ type: 'relay-reply-result', requestId, ok: true, message_id: sent.id });
    } catch (err: any) {
      (process as any).send?.({ type: 'relay-reply-result', requestId, ok: false, error: String(err?.message ?? err) });
    }
  });

  await client.login(token);
}
