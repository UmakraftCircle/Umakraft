import cron from 'node-cron';
import { TextChannel, Client } from 'discord.js';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { detectNewMilestone, detectMonthlyAchievement } from '@ai-agent-platform/ai';
import type { MonthlyTier, MonthlyAchiever } from '@ai-agent-platform/ai';
import type { GreetingService, DailyMessageService, MilestoneMessageService, MonthlyAchievementService, ReminderMessageService, DailyAchievementService } from '@ai-agent-platform/ai';
import type { MessageSupervisor } from './supervisor.js';
import { logger } from './bootstrap.js';

interface CronDeps {
  client: Client;
  greetingService: GreetingService;
  dailyService: DailyMessageService;
  milestoneService: MilestoneMessageService;
  monthlyService: MonthlyAchievementService;
  reminderService: ReminderMessageService;
  dailyAchievementService: DailyAchievementService;
  supervisor: MessageSupervisor;
}

export async function registerMilestoneJobs(deps: CronDeps): Promise<void> {
  const { client, milestoneService, monthlyService, supervisor } = deps;
  const tz = process.env['TZ'] || 'Asia/Manila';
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

  // ── Monthly Top 3 Achievement (after tally period on 1st of month at 10AM) ──

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

      const [links, members] = await Promise.all([
        trainerLinkStore.getAll(),
        fanTrackerAPI.fetchAllMembers(),
      ]);

      if (links.length === 0) {
        logger.info('Monthly check: no linked members — skipping.');
        return;
      }

      const linkedIds = new Set(links.map(l => l.trainerId));
      const monthlyMap = new Map<string, number>();
      const tierMap = new Map<string, string>();
      for (const m of members) {
        if (linkedIds.has(m.trainerId)) {
          monthlyMap.set(m.trainerId, m.monthlyFans ?? 0);
          tierMap.set(m.trainerId, m.clubRankTier ?? '-');
        }
      }

      // Build ranked top 3 monthly champions
      const rankedMonthly: MonthlyAchiever[] = links
        .map((link) => {
          const monthlyGain = monthlyMap.get(link.trainerId) ?? 0;
          return {
            trainerName: link.trainerName,
            discordUserId: link.discordUserId,
            trainerId: link.trainerId,
            monthlyGain,
            tier: tierMap.get(link.trainerId) ?? 'Active',
            rank: 0,
          };
        })
        .sort((a, b) => b.monthlyGain - a.monthlyGain)
        .slice(0, 3)
        .map((a, i) => ({ ...a, rank: i + 1 }));

      if (rankedMonthly.length === 0) {
        logger.info('Monthly check: no ranked monthly champions — skipping.');
        return;
      }

      // Refresh stale names from live API before generating the message
      for (const achiever of rankedMonthly) {
        const live = members.find(m => m.trainerId === achiever.trainerId);
        if (live?.trainerName && !live.trainerName.startsWith('[MOCK]')) {
          achiever.trainerName = live.trainerName;
        }
      }

      const msg = await monthlyService.generateMonthlyTop3(rankedMonthly, guild.name);
      await supervisor.trySend(channel, msg, `monthly-top3:${rankedMonthly.length}`);

      logger.info(
        `👑 Monthly Top 3 sent: top ${rankedMonthly.length} champions ` +
        `(${rankedMonthly.map(a => `${a.trainerName}: +${(a.monthlyGain / 1_000_000).toFixed(1)}M`).join(', ')})`,
      );

      saveMilestoneState().catch(() => {});
    } catch (err: any) {
      logger.error(`Monthly achievement check failed: ${err.message}`);
    }
  };

  // First day of every month at 10 AM
  cron.schedule('0 10 1 * *', checkMonthlyAchievements, { timezone: tz });
  logger.info(`Monthly achievement check scheduled (${tz}): 1st of month at 10AM`);
}
