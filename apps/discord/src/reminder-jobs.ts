import cron from 'node-cron';
import { TextChannel, Client } from 'discord.js';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import type { TrainerGap, DailyAchiever } from '@ai-agent-platform/ai';
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

export function registerReminderJobs(deps: CronDeps): void {
  const { client, reminderService, dailyAchievementService, supervisor } = deps;
  const tz = process.env['TZ'] || 'Asia/Manila';
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

      // Build ranked top 3 by daily gain
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
        .slice(0, 3)
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
}
