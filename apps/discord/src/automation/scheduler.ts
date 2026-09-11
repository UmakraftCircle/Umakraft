import cron from 'node-cron';
import type { Client } from 'discord.js';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { createLogger } from '@ai-agent-platform/shared';
import { dmMemoryStore } from './dm-memory.js';
import { getLeaderboard } from './fan-leaderboard.js';
import { runMonthlyTally } from './monthly-tally.js';
import { fanPaceService } from './fan-pace.js';
import { lilyProactiveEngine } from './lily-proactive-engine.js';

const logger = createLogger('Automation-Scheduler');

/**
 * Task 1: Refresh Fan Data from external source / API
 */
export async function refreshFanData(): Promise<void> {
  try {
    logger.info('[Scheduler] Refreshing fan data cache...');
    await fanTrackerAPI.fetchLeaderboard('unified');
    logger.info('[Scheduler] Fan data cache refreshed successfully.');
  } catch (err: any) {
    logger.error(`[Scheduler] refreshFanData failed: ${err?.message}`);
  }
}

/**
 * Task 2: Update Leaderboard pre-cached stats
 */
export async function updateLeaderboard(): Promise<void> {
  try {
    logger.info('[Scheduler] Pre-caching leaderboard rankings...');
    await getLeaderboard('unified', 'daily', 10);
    logger.info('[Scheduler] Leaderboard updated.');
  } catch (err: any) {
    logger.error(`[Scheduler] updateLeaderboard failed: ${err?.message}`);
  }
}

/**
 * Task 3: Clean old DM conversation history
 */
export async function cleanupDMHistory(): Promise<void> {
  try {
    logger.info('[Scheduler] Cleaning expired DM memory...');
    const evicted = dmMemoryStore.cleanMemory(24 * 60 * 60 * 1000);
    logger.info(`[Scheduler] Cleaned ${evicted} expired DM memory records.`);
  } catch (err: any) {
    logger.error(`[Scheduler] cleanupDMHistory failed: ${err?.message}`);
  }
}

/**
 * Task 4: Consistency Check Job (runs every 6 hours).
 * Verifies leaderboard ranking matches database/source totals.
 * Automatically rebuilds leaderboard if desynchronization is detected.
 */
export async function runLeaderboardConsistencyCheck(): Promise<void> {
  try {
    logger.info('[Scheduler] Running 6-hour leaderboard consistency check...');
    const cachedStats = await fanTrackerAPI.fetchLeaderboard('unified', false);
    const freshStats = await fanTrackerAPI.fetchLeaderboard('unified', true);

    let isDesynced = cachedStats.length !== freshStats.length;
    if (!isDesynced) {
      for (let i = 0; i < cachedStats.length; i++) {
        if (
          cachedStats[i].trainerId !== freshStats[i].trainerId ||
          cachedStats[i].totalFans !== freshStats[i].totalFans ||
          cachedStats[i].monthlyFans !== freshStats[i].monthlyFans
        ) {
          isDesynced = true;
          break;
        }
      }
    }

    if (isDesynced) {
      logger.warn('Leaderboard desynchronization detected.');
      await fanTrackerAPI.refreshLeaderboard('unified');
      logger.info('Leaderboard rebuilt successfully.');
    } else {
      logger.info('[Scheduler] Leaderboard consistency check passed — rankings synchronized.');
    }
  } catch (err: any) {
    logger.error(`[Scheduler] Leaderboard consistency check error: ${err?.message}`);
  }
}

/**
 * Starts the automation background jobs (Hourly, Daily Reminders, 6-hour Consistency & Monthly Tally).
 */
export function initScheduler(client?: Client): void {
  const tz = process.env['TZ'] || 'Asia/Manila';

  // Job 1: Run every hour at minute 0 ("0 * * * *")
  cron.schedule(
    '0 * * * *',
    async () => {
      logger.info('[Scheduler] Hourly background job triggered.');
      await refreshFanData();
      await updateLeaderboard();
      await cleanupDMHistory();
    },
    { timezone: tz }
  );

  // Job 2: Run daily pace reminders at 09:00 AM ("0 9 * * *")
  cron.schedule(
    '0 9 * * *',
    async () => {
      logger.info('[Scheduler] Daily pace reminder job triggered (0 9 * * *)...');
      if (client) {
        await fanPaceService.sendDailyPaceReminders(client);
      }
    },
    { timezone: tz }
  );

  // Job 3: Run consistency check job every 6 hours ("0 */6 * * *")
  cron.schedule(
    '0 */6 * * *',
    async () => {
      logger.info('[Scheduler] 6-hour Leaderboard Consistency Check Job triggered (0 */6 * * *)...');
      await runLeaderboardConsistencyCheck();
    },
    { timezone: tz }
  );

  // Job 4: Run once after the official monthly tally closes (1st of every month at midnight "0 0 1 * *")
  cron.schedule(
    '0 0 1 * *',
    async () => {
      logger.info('[Scheduler] Monthly Tally background job triggered (0 0 1 * *)...');
      await runMonthlyTally(client);
    },
    { timezone: tz }
  );

  // Job 5: Run Lily Proactive Engine every 3 hours ("0 */3 * * *")
  cron.schedule(
    '0 */3 * * *',
    async () => {
      logger.info('[Scheduler] Lily Proactive Engine job triggered (0 */3 * * *)...');
      if (client) {
        // Collect active user IDs from cached trainer memory
        const activeUsers = ['123456789']; // Example or fetched from active cache
        await lilyProactiveEngine.evaluateProactiveQueue(client, activeUsers);
      }
    },
    { timezone: tz }
  );

  logger.info(`[Scheduler] Hourly, Daily Reminders, 6-Hour Consistency, Monthly Tally, and Proactive Engine background cron jobs initialized (${tz}).`);
}
