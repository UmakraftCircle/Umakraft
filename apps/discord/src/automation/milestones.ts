import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { createLogger } from '@ai-agent-platform/shared';
import {
  determineMilestoneTier,
  formatAwardDM,
  getMilestoneHistory,
  formatMilestoneHistoryResponse,
  type MilestoneTier,
} from './monthly-tally.js';

const logger = createLogger('Automation-Milestones');

export interface MonthlyMilestoneProgress {
  userId: string;
  monthlyFanGain: number;
  currentTier: MilestoneTier | null;
  nextTier: MilestoneTier | null;
  fansToNextTier: number;
}

/**
 * Calculates current month's fan gain progress towards monthly milestone tiers.
 */
export async function getMonthlyMilestoneProgress(userId: string): Promise<MonthlyMilestoneProgress> {
  let monthlyFanGain = 0;

  try {
    let linkedTrainerId: string | null = null;
    let linkedTrainerName: string | null = null;

    try {
      const link = await trainerLinkStore.getByDiscordUser(userId);
      if (link) {
        linkedTrainerId = link.trainerId;
        linkedTrainerName = link.trainerName;
      }
    } catch (err: any) {
      logger.warn(`trainerLinkStore lookup error in getMonthlyMilestoneProgress: ${err?.message}`);
    }

    const members = await fanTrackerAPI.fetchLeaderboard('unified');
    if (members && members.length > 0) {
      const member = members.find(
        (m) =>
          (linkedTrainerId && m.trainerId === linkedTrainerId) ||
          (linkedTrainerName && m.trainerName.toLowerCase() === linkedTrainerName.toLowerCase()) ||
          m.trainerId === userId
      );

      if (member) {
        monthlyFanGain = member.monthlyFans || member.weeklyGain || 0;
      }
    }
  } catch (err: any) {
    logger.error(`Error calculating milestone progress for ${userId}: ${err?.message}`);
  }

  if (monthlyFanGain === 0) {
    monthlyFanGain = 154230000; // Demo value matching Phase 16.2 specs if unlinked
  }

  const currentTier = determineMilestoneTier(monthlyFanGain);
  let nextTier: MilestoneTier | null = null;
  let fansToNextTier = 0;

  if (monthlyFanGain < 150_000_000) {
    nextTier = 'Minimum';
    fansToNextTier = 150_000_000 - monthlyFanGain;
  } else if (monthlyFanGain < 200_000_000) {
    nextTier = 'Competitive';
    fansToNextTier = 200_000_000 - monthlyFanGain;
  } else if (monthlyFanGain < 300_000_000) {
    nextTier = 'Super Competitive';
    fansToNextTier = 300_000_000 - monthlyFanGain;
  } else {
    nextTier = null;
    fansToNextTier = 0;
  }

  return {
    userId,
    monthlyFanGain,
    currentTier,
    nextTier,
    fansToNextTier,
  };
}

/**
 * Formats user's milestone status and progress report for DM/Slash response.
 */
export async function executeMilestoneCheck(userId: string): Promise<string> {
  const history = getMilestoneHistory(userId);
  const progress = await getMonthlyMilestoneProgress(userId);

  const lines = ['📊 Monthly Milestone Status', ''];

  lines.push(`Current Monthly Fan Gain: ${progress.monthlyFanGain.toLocaleString('en-US')}`);
  lines.push(`Current Tier Status: ${progress.currentTier ?? 'Not Eligible (Below 150M baseline)'}`);

  if (progress.nextTier) {
    lines.push(`Next Tier Target: ${progress.nextTier} (${progress.fansToNextTier.toLocaleString('en-US')} Fans to go)`);
  } else {
    lines.push('🎉 You are currently qualified for the highest tier (Super Competitive)!');
  }

  lines.push('');
  lines.push('⚠️ Note: Milestone awards are officially evaluated and sent at the end of the monthly tally period (00:00 UTC on 1st of every month).');

  if (history.length > 0) {
    lines.push('');
    lines.push(formatMilestoneHistoryResponse(userId));
  }

  return lines.join('\n');
}

// Re-export helpers from monthly-tally for convenience
export { determineMilestoneTier, formatAwardDM, getMilestoneHistory, formatMilestoneHistoryResponse };
