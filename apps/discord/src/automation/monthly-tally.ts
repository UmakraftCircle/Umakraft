import type { Client } from 'discord.js';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { createLogger } from '@ai-agent-platform/shared';
import { resetMonthlyAchievementFlags } from './fan-pace.js';

const logger = createLogger('Automation-MonthlyTally');

export type MilestoneTier = 'Minimum' | 'Competitive' | 'Super Competitive';

export interface MonthlyMilestoneRecord {
  month: string; // e.g. "2026-09"
  fanGain: number;
  tier: MilestoneTier;
  awardedAt: string;
}

// Global historical records per user ID
const monthlyMilestoneHistory = new Map<string, MonthlyMilestoneRecord[]>();

// Tally Lock state
let isTallyLocked = false;

/**
 * Returns historical monthly milestone records for a given user.
 */
export function getMilestoneHistory(userId: string): MonthlyMilestoneRecord[] {
  return monthlyMilestoneHistory.get(userId) ?? [];
}

/**
 * Adds a new milestone record to historical store.
 */
export function recordMilestoneAward(userId: string, record: MonthlyMilestoneRecord): void {
  const history = monthlyMilestoneHistory.get(userId) ?? [];
  history.push(record);
  monthlyMilestoneHistory.set(userId, history);
}

/**
 * Determines milestone tier based on final monthly fan gain.
 */
export function determineMilestoneTier(monthlyFanGain: number): MilestoneTier | null {
  if (monthlyFanGain >= 300_000_000) {
    return 'Super Competitive';
  }
  if (monthlyFanGain >= 200_000_000) {
    return 'Competitive';
  }
  if (monthlyFanGain >= 150_000_000) {
    return 'Minimum';
  }
  return null;
}

/**
 * Generates the standardized DM Award Message according to tier specifications.
 */
export function formatAwardDM(tier: MilestoneTier, monthlyFanGain: number): string {
  const formattedGain = monthlyFanGain.toLocaleString('en-US');

  switch (tier) {
    case 'Minimum':
      return [
        '🎉 **Congratulations!**',
        'You\'ve reached the **150M milestone** and achieved **Minimum** status.',
        '',
        `• **Monthly Fan Gain:** ${formattedGain}`,
        'Keep up the steady progress toward Competitive next month!',
      ].join('\n');

    case 'Competitive':
      return [
        '🎉 **Congratulations!**',
        'You\'ve reached the **200M milestone** and achieved **Competitive** status.',
        '',
        `• **Monthly Fan Gain:** ${formattedGain}`,
        'Great work exceeding the baseline requirement!',
      ].join('\n');

    case 'Super Competitive':
      return [
        '🏆 **Congratulations!**',
        'You\'ve reached the **300M milestone** and achieved **Super Competitive** status.',
        '',
        `• **Monthly Fan Gain:** ${formattedGain}`,
        'Outstanding effort finishing in our highest milestone category!',
      ].join('\n');
  }
}

/**
 * Main process executing the monthly tally evaluation and milestone award distribution.
 */
export async function runMonthlyTally(client?: Client): Promise<{
  month: string;
  evaluatedCount: number;
  awardedCount: number;
}> {
  if (isTallyLocked) {
    logger.warn('[Monthly Tally] Tally process is already running and locked.');
    return { month: getCurrentMonthString(), evaluatedCount: 0, awardedCount: 0 };
  }

  const currentMonth = getCurrentMonthString();
  logger.info(`[Monthly Tally] Step 1: Locking tally for period ${currentMonth}...`);
  isTallyLocked = true;

  let evaluatedCount = 0;
  let awardedCount = 0;

  try {
    // Step 2: Load All Trainers and Fan Data
    logger.info('[Monthly Tally] Step 2: Loading trainers and calculating final monthly fan gain...');
    const allLinks = await trainerLinkStore.getAll();
    const leaderboardMembers = await fanTrackerAPI.fetchLeaderboard('unified');

    // Process each linked trainer
    for (const link of allLinks) {
      if (!link.discordUserId) continue;
      evaluatedCount++;

      const member = leaderboardMembers?.find(
        (m) =>
          m.trainerId === link.trainerId ||
          m.trainerName.toLowerCase() === link.trainerName.toLowerCase() ||
          m.trainerId === link.discordUserId
      );

      // Determine monthly fan gain
      const monthlyGain = member?.monthlyFans || member?.weeklyGain || 0;
      const tier = determineMilestoneTier(monthlyGain);

      // Step 3: Evaluate Eligibility
      if (tier) {
        awardedCount++;
        const awardMessage = formatAwardDM(tier, monthlyGain);

        // Step 4: Send Award DM
        if (client) {
          try {
            const discordUser = await client.users.fetch(link.discordUserId).catch(() => null);
            if (discordUser) {
              await discordUser.send(awardMessage);
              logger.info(`[Monthly Tally] Delivered ${tier} Award DM to ${discordUser.tag} (${link.discordUserId})`);
            }
          } catch (dmErr: any) {
            logger.warn(`[Monthly Tally] Failed to send DM to user ${link.discordUserId}: ${dmErr?.message}`);
          }
        }

        // Step 5: Archive Results
        recordMilestoneAward(link.discordUserId, {
          month: currentMonth,
          fanGain: monthlyGain,
          tier,
          awardedAt: new Date().toISOString(),
        });
      } else {
        logger.info(`[Monthly Tally] User ${link.discordUserId} (${monthlyGain.toLocaleString()} Fans) - Ineligible (below 150M baseline). No award sent.`);
      }
    }

    logger.info(`[Monthly Tally] Step 6: Archiving historical records. Total evaluated: ${evaluatedCount}, Total awarded: ${awardedCount}.`);
  } catch (err: any) {
    logger.error(`[Monthly Tally] Error during monthly tally execution: ${err?.message}`);
  } finally {
    // Step 7: Reset counters and unlock tally period
    logger.info('[Monthly Tally] Step 7: Resetting monthly counters and opening new tally period...');
    resetMonthlyAchievementFlags();
    isTallyLocked = false;
    logger.info('[Monthly Tally] New tally period opened successfully.');
  }

  return {
    month: currentMonth,
    evaluatedCount,
    awardedCount,
  };
}

/**
 * Returns formatted string for current month, e.g. "2026-09"
 */
function getCurrentMonthString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Formats a user's milestone history or last month award query response.
 */
export function formatMilestoneHistoryResponse(userId: string): string {
  const history = getMilestoneHistory(userId);

  if (!history || history.length === 0) {
    return [
      '📜 Monthly Milestone History',
      '',
      'You currently have no recorded monthly milestone awards.',
      '',
      'Note: Monthly milestones are evaluated and awarded at the close of each monthly tally period.',
      'Baseline Requirement: 150,000,000+ Monthly Fan Gain.',
    ].join('\n');
  }

  const lines = ['📜 Monthly Milestone History', ''];
  history.forEach((rec) => {
    lines.push(`• Month: ${rec.month}`);
    lines.push(`  Tier: ${rec.tier}`);
    lines.push(`  Fan Gain: ${rec.fanGain.toLocaleString('en-US')}`);
    lines.push('');
  });

  return lines.join('\n').trim();
}
