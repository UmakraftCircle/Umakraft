import { Client, GatewayIntentBits, REST, Routes, Events, Interaction, TextChannel } from 'discord.js';
import { createLogger, PLATFORM_NAME } from '@ai-agent-platform/shared';
import { toolRegistry } from '@ai-agent-platform/core';
import { GreetingService, DailyMessageService, MilestoneMessageService, MonthlyAchievementService, ReminderMessageService, DailyAchievementService, RaceCommentaryService, promptLibrary, createProvider, loadRaceState, saveRaceState, buildRaceState } from '@ai-agent-platform/ai';
import type { TimeSlot, MilestoneInfo, MonthlyTier, TrainerGap, DailyAchiever, RacerData, RaceState } from '@ai-agent-platform/ai';
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

  // ── New Member Greeting ──
  const groqKey = process.env['GROQ_API_KEY'];
  let greetingService: GreetingService;
  let dailyService: DailyMessageService;
  let milestoneService: MilestoneMessageService;
  let monthlyService: MonthlyAchievementService;
  let reminderService: ReminderMessageService;
  let dailyAchievementService: DailyAchievementService;
  let raceCommentaryService: RaceCommentaryService;
  const supervisor = new MessageSupervisor();

  if (groqKey) {
    const primaryAI = createProvider('groq', groqKey, 'llama-3.3-70b-versatile');
    const fallbackAI = createProvider('groq', groqKey, 'mixtral-8x7b-32768');
    greetingService = new GreetingService(primaryAI, promptLibrary, fallbackAI);
    dailyService = new DailyMessageService(primaryAI, promptLibrary, fallbackAI);
    milestoneService = new MilestoneMessageService(primaryAI, promptLibrary, fallbackAI);
    monthlyService = new MonthlyAchievementService(primaryAI, promptLibrary, fallbackAI);
    reminderService = new ReminderMessageService(primaryAI, promptLibrary, fallbackAI);
    dailyAchievementService = new DailyAchievementService(primaryAI, promptLibrary, fallbackAI);
    raceCommentaryService = new RaceCommentaryService(primaryAI, promptLibrary, fallbackAI);
    logger.info('Services initialized: Greeting, Daily, Milestone, Monthly, Reminder, DailyAchievement, RaceCommentary');
  } else {
    logger.warn('No GROQ_API_KEY set — all services in cache-only fallback mode.');
    greetingService = new GreetingService(null, promptLibrary);
    dailyService = new DailyMessageService(null, promptLibrary);
    milestoneService = new MilestoneMessageService(null, promptLibrary);
    monthlyService = new MonthlyAchievementService(null, promptLibrary);
    reminderService = new ReminderMessageService(null, promptLibrary);
    dailyAchievementService = new DailyAchievementService(null, promptLibrary);
    raceCommentaryService = new RaceCommentaryService(null, promptLibrary);
  }

  logger.info(`MessageSupervisor initialized (60min retry, ${supervisor.pendingCount} pending)`);

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const guild = member.guild;

      // Find a suitable welcome channel
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
      logger.info(`✅ Welcomed ${member.user.tag} in #${welcomeChannel.name} (${guild.name})`);
    } catch (err: any) {
      logger.error(`Failed to send welcome for ${member.user?.tag}: ${err.message}`);
    }
  });

  logger.info(`Registered guildMemberAdd → greeting handler (cached: ${greetingService.getCachedCount()})`);

  // ── Daily Message Cron Jobs (morning / noon / evening / midnight) ──

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
        `(pools: ☀${pools.morning} 🌤${pools.noon} 🌅${pools.evening} 🌙${pools.midnight})`,
      );
    } catch (err: any) {
      logger.error(`Daily [${timeSlot}] failed: ${err.message}`);
    }
  };

  const tz = process.env['TZ'] || 'Asia/Manila';

  cron.schedule('0 8 * * *',   () => sendDailyMessage('morning',  '☀️'),  { timezone: tz });
  cron.schedule('0 12 * * *',  () => sendDailyMessage('noon',     '🌤️'), { timezone: tz });
  cron.schedule('0 18 * * *',  () => sendDailyMessage('evening',  '🌅'),  { timezone: tz });
  cron.schedule('0 0 * * *',   () => sendDailyMessage('midnight', '🌙'),  { timezone: tz });

  logger.info(`Daily cron jobs scheduled (${tz}): ☀️ 8AM  🌤️ 12PM  🌅 6PM  🌙 12AM`);

  // ── Milestone Tracker (fan-count milestone detection) ──
  // Persisted to file so milestones aren't lost across restarts (audit #11)
  const MILESTONE_STATE_FILE = process.env['MILESTONE_STATE_FILE'] || '.cache/milestone-state.json';

  const previousFanCounts = new Map<string, number>(); // trainerId → last known fan count
  const previousMonthlyGains = new Map<string, number>(); // trainerId → last month's gain

  async function loadMilestoneState(): Promise<void> {
    try {
      const fs = await import('node:fs/promises');
      const raw = await fs.readFile(MILESTONE_STATE_FILE, 'utf-8');
      const state = JSON.parse(raw);
      if (state.fanCounts) {
        for (const [k, v] of Object.entries(state.fanCounts)) {
          previousFanCounts.set(k, v as number);
        }
      }
      if (state.monthlyGains) {
        for (const [k, v] of Object.entries(state.monthlyGains)) {
          previousMonthlyGains.set(k, v as number);
        }
      }
      logger.info(`Loaded milestone state: ${previousFanCounts.size} fan counts, ${previousMonthlyGains.size} monthly gains`);
    } catch {
      // First run
    }
  }

  async function saveMilestoneState(): Promise<void> {
    try {
      const fs = await import('node:fs/promises');
      const pathMod = await import('node:path');
      await fs.mkdir(pathMod.dirname(MILESTONE_STATE_FILE), { recursive: true });
      await fs.writeFile(MILESTONE_STATE_FILE, JSON.stringify({
        fanCounts: Object.fromEntries(previousFanCounts),
        monthlyGains: Object.fromEntries(previousMonthlyGains),
      }, null, 2), 'utf-8');
    } catch (err: any) {
      logger.warn(`Failed to persist milestone state: ${err.message}`);
    }
  }

  // Load persisted state at startup so restarts don't miss milestones (audit #11)
  await loadMilestoneState();

  const checkAndSendMilestones = async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) { logger.warn('Milestone check: no guild available.'); return; }

      const channel: TextChannel | undefined =
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased() && c.name === 'bot-announcement',
        ) as TextChannel | undefined) ??
        guild.systemChannel ??
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased(),
        ) as TextChannel | undefined);

      if (!channel) { logger.warn('Milestone check: no suitable channel.'); return; }

      const members = await fanTrackerAPI.fetchAllMembers();
      logger.info(`Milestone check: fetched ${members.length} members from fan tracker.`);

      for (const member of members) {
        const prev = previousFanCounts.get(member.trainerId);
        const curr = member.totalFans;

        // Initialize tracking on first run (don't trigger on initial data load)
        if (prev === undefined) {
          previousFanCounts.set(member.trainerId, curr);
          continue;
        }

        const milestone = detectNewMilestone(prev, curr);
        if (milestone) {
          const msg = await milestoneService.generateMilestoneMessage(
            milestone.tier,
            member.trainerName,
            curr,
            guild.name,
          );
          await supervisor.trySend(channel, msg, `milestone:${milestone.title}:${member.trainerName}`);
          logger.info(
            `${milestone.emoji} Milestone [${milestone.title}] sent for ${member.trainerName} ` +
            `(${prev.toLocaleString()} → ${curr.toLocaleString()} fans)`,
          );

          // Update stored count to prevent re-triggering
          previousFanCounts.set(member.trainerId, curr);
        }

        // Always update if count increased
        if (curr > prev) {
          previousFanCounts.set(member.trainerId, curr);
        }
      }

      logger.info('Milestone check complete.');
      saveMilestoneState().catch(() => {});
    } catch (err: any) {
      logger.error(`Milestone check failed: ${err.message}`);
    }
  };

  // Check milestones daily at 9 AM (after morning message, giving time for data sync)
  cron.schedule('0 9 * * *', checkAndSendMilestones, { timezone: tz });
  logger.info(`Milestone check scheduled (${tz}): daily at 9AM`);

  // ── Monthly Achievement Check (1st of month at 10AM) ──

  const checkMonthlyAchievements = async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) { logger.warn('Monthly check: no guild available.'); return; }

      const channel: TextChannel | undefined =
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased() && c.name === 'bot-announcement',
        ) as TextChannel | undefined) ??
        guild.systemChannel ??
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased(),
        ) as TextChannel | undefined);

      if (!channel) { logger.warn('Monthly check: no suitable channel.'); return; }

      const members = await fanTrackerAPI.fetchAllMembers();
      logger.info(`Monthly achievement check: fetched ${members.length} members.`);

      for (const member of members) {
        const prev = previousMonthlyGains.get(member.trainerId);
        const curr = member.monthlyFans ?? 0;

        if (prev === undefined) {
          previousMonthlyGains.set(member.trainerId, curr);
          continue;
        }

        const achievement = detectMonthlyAchievement(prev, curr);
        if (achievement) {
          const msg = await monthlyService.generateAchievementMessage(
            achievement.tier, member.trainerName, curr, guild.name,
          );
          await supervisor.trySend(channel, msg, `monthly:${achievement.title}:${member.trainerName}`);
          logger.info(
            `${achievement.emoji} Monthly [${achievement.title}] sent for ${member.trainerName} ` +
            `(${prev.toLocaleString()} → ${curr.toLocaleString()} monthly gain)`,
          );
        }

        if (curr > prev) previousMonthlyGains.set(member.trainerId, curr);
      }

      logger.info('Monthly achievement check complete.');
      saveMilestoneState().catch(() => {});
    } catch (err: any) {
      logger.error(`Monthly achievement check failed: ${err.message}`);
    }
  };

  // First day of every month at 10 AM
  cron.schedule('0 10 1 * *', checkMonthlyAchievements, { timezone: tz });
  logger.info(`Monthly achievement check scheduled (${tz}): 1st of month at 10AM`);

  // ── Daily Gap Reminder (linked trainers below 60M monthly) ──

  const sendGapReminder = async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) { logger.warn('Gap reminder: no guild available.'); return; }

      const channel: TextChannel | undefined =
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased() && c.name === 'bot-message',
        ) as TextChannel | undefined) ??
        guild.systemChannel ??
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased(),
        ) as TextChannel | undefined);

      if (!channel) { logger.warn('Gap reminder: no suitable channel.'); return; }

      const [links, members] = await Promise.all([
        trainerLinkStore.getAll(),
        fanTrackerAPI.fetchAllMembers(),
      ]);

      if (links.length === 0) {
        logger.info('Gap reminder: no linked members — skipping.');
        return;
      }

      const linkedIds = new Set(links.map(l => l.trainerId));
      const monthlyMap = new Map<string, number>();
      for (const m of members) monthlyMap.set(m.trainerId, m.monthlyFans ?? 0);

      const gaps: TrainerGap[] = [];
      for (const link of links) {
        const monthly = monthlyMap.get(link.trainerId) ?? 0;
        if (monthly >= 60_000_000) continue; // graduated
        gaps.push({
          trainerName: link.trainerName,
          discordUserId: link.discordUserId,
          trainerId: link.trainerId,
          monthlyFans: monthly,
          deficit: 60_000_000 - monthly,
        });
      }

      // Refresh stale names from live API before generating the message
      for (const gap of gaps) {
        const live = members.find(m => m.trainerId === gap.trainerId);
        if (live?.trainerName && !live.trainerName.startsWith('[MOCK]')) {
          gap.trainerName = live.trainerName;
        }
      }

      if (gaps.length === 0) {
        logger.info('Gap reminder: all linked trainers have 60M+ monthly — skipping.');
        return;
      }

      // Skip if all monthly counts are zero — API may be down
      const allZero = gaps.every(g => g.monthlyFans === 0);
      if (allZero) {
        logger.warn('Gap reminder: all monthly counts are 0 — API may be down, skipping.');
        return;
      }

      const msg = await reminderService.generateReminder(gaps, guild.name);
      await supervisor.trySend(channel, msg, `gap-reminder:${gaps.length}`);

      const pool = reminderService.getPoolSize();
      logger.info(
        `🎯 Gap reminder sent: ${gaps.length} trainer(s) below 60M monthly ` +
        `(${gaps.map(g => `${g.trainerName}: ${(g.deficit/1e6).toFixed(1)}M deficit`).join(', ')}) ` +
        `(cache: ${pool})`,
      );
    } catch (err: any) {
      logger.error(`Gap reminder failed: ${err.message}`);
    }
  };

  // Daily at 7 AM — morning motivation before the morning message
  cron.schedule('0 7 * * *', sendGapReminder, { timezone: tz });
  logger.info(`Gap reminder scheduled (${tz}): daily at 7AM`);

  // ── Daily Achievement Top 10 (evening recap of the day's best) ──

  const sendDailyAchievement = async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) { logger.warn('Daily achievement: no guild available.'); return; }

      const channel: TextChannel | undefined =
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased() && c.name === 'bot-message',
        ) as TextChannel | undefined) ??
        guild.systemChannel ??
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased(),
        ) as TextChannel | undefined);

      if (!channel) { logger.warn('Daily achievement: no suitable channel.'); return; }

      const [links, members] = await Promise.all([
        trainerLinkStore.getAll(),
        fanTrackerAPI.fetchAllMembers(),
      ]);

      if (links.length === 0) {
        logger.info('Daily achievement: no linked members — skipping.');
        return;
      }

      const linkedIds = new Set(links.map(l => l.trainerId));
      const dailyMap = new Map<string, number>();
      const tierMap = new Map<string, string>();
      for (const m of members) {
        if (linkedIds.has(m.trainerId)) {
          dailyMap.set(m.trainerId, m.dailyGain ?? 0);
          tierMap.set(m.trainerId, m.clubRankTier ?? '-');
        }
      }

      // Build ranked top 10 by daily gain
      const ranked: DailyAchiever[] = links
        .map((link) => ({
          trainerName: link.trainerName,
          discordUserId: link.discordUserId,
          trainerId: link.trainerId,
          dailyGain: dailyMap.get(link.trainerId) ?? 0,
          tier: tierMap.get(link.trainerId) ?? '-',
          rank: 0, // placeholder, assigned after sort
        }))
        .sort((a, b) => b.dailyGain - a.dailyGain)
        .slice(0, 10)
        .map((a, i) => ({ ...a, rank: i + 1 }));

      if (ranked.length === 0) {
        logger.info('Daily achievement: no ranked achievers — skipping.');
        return;
      }

      // Skip if all daily gains are zero — API may be down
      const allZero = ranked.every(a => a.dailyGain === 0);
      if (allZero) {
        logger.warn('Daily achievement: all daily gains are 0 — API may be down, skipping.');
        return;
      }

      // Refresh stale names from live API before generating the message
      for (const achiever of ranked) {
        const live = members.find(m => m.trainerId === achiever.trainerId);
        if (live?.trainerName && !live.trainerName.startsWith('[MOCK]')) {
          achiever.trainerName = live.trainerName;
        }
      }

      const msg = await dailyAchievementService.generateDailyTop10(ranked, guild.name);
      await supervisor.trySend(channel, msg, `daily-achievement:${ranked.length}`);

      logger.info(
        `🌟 Daily achievement sent: top ${ranked.length} trainers ` +
        `(${ranked.map(a => `${a.trainerName}: +${(a.dailyGain / 1_000_000).toFixed(1)}M`).join(', ')}) ` +
        `(cache: ${dailyAchievementService.getPoolSize()})`,
      );
    } catch (err: any) {
      logger.error(`Daily achievement failed: ${err.message}`);
    }
  };

  // Daily at 8 PM — evening recap of the day's top performers
  cron.schedule('0 20 * * *', sendDailyAchievement, { timezone: tz });
  logger.info(`Daily achievement scheduled (${tz}): daily at 8PM`);

  // ── Daily Race Commentary (top 30 trainers, 3000m track) ──

  const RACE_STATE_FILE = process.env['RACE_STATE_FILE'] || '.cache/race-state.json';

  const sendRaceCommentary = async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) { logger.warn('Race commentary: no guild available.'); return; }

      const channel: TextChannel | undefined =
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased() && c.name === 'bot-message',
        ) as TextChannel | undefined) ??
        guild.systemChannel ??
        (guild.channels.cache.find(
          (c): c is TextChannel => c.isTextBased() && !c.isDMBased(),
        ) as TextChannel | undefined);

      if (!channel) { logger.warn('Race commentary: no suitable channel.'); return; }

      const now = new Date();
      const currentMonth = now.getMonth() + 1;

      // Load state — reset on month change
      let state = await loadRaceState(RACE_STATE_FILE);
      if (state && state.month !== currentMonth) {
        logger.info(`Race commentary: month changed (${state.month} → ${currentMonth}) — resetting track.`);
        state = null;
      }

      const members = await fanTrackerAPI.fetchAllMembers();
      const allRacers: RacerData[] = members.map(m => ({
        trainerId: m.trainerId,
        trainerName: m.trainerName,
        monthlyFans: m.monthlyFans ?? 0,
      }));

      const positions = RaceCommentaryService.calculatePositions(allRacers);
      const events = RaceCommentaryService.detectEvents(positions, state);
      const newState = buildRaceState(positions, positions.map(p => p.name));
      newState.day = now.getDate();
      newState.month = currentMonth;

      if (state) {
        newState.day = state.day + 1 > new Date(new Date().getFullYear(), newState.month, 0).getDate() ? 1 : state.day + 1;
      }

      const msg = await raceCommentaryService.generateCommentary(
        positions,
        events,
        newState,
        guild.name,
      );

      await supervisor.trySend(channel, msg, `race-commentary:day${newState.day}`);
      await saveRaceState(RACE_STATE_FILE, newState);

      const finishers = positions.filter(p => p.finished).length;
      logger.info(
        `🏇 Race commentary [Day ${newState.day}] sent to #${channel.name} ` +
        `(${positions.length} racers, ${events.length} events, ${finishers} finished) ` +
        `(cache: ${raceCommentaryService.getPoolSize()})`,
      );
    } catch (err: any) {
      logger.error(`Race commentary failed: ${err.message}`);
    }
  };

  // Daily at 9 PM — end-of-day race broadcast
  cron.schedule('0 21 * * *', sendRaceCommentary, { timezone: tz });
  logger.info(`Race commentary scheduled (${tz}): daily at 9PM`);

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
  const circleIds = (process.env['UMAMOE_CIRCLE_IDS'] || process.env['UMAMOE_CIRCLE_ID'] || '974470619,325938032').split(',').map(s => s.trim());

  logger.info('='.repeat(50));
  logger.info(`Starting ${PLATFORM_NAME} Discord Service...`);
  logger.info('='.repeat(50));
  logger.info(`uma.moe API: ${umaKey ? '✅ key configured' : '⚠️ no key — may hit rate limits'}`);
  logger.info(`Circle IDs: ${circleIds.join(', ')}`);

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
