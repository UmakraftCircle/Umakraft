import type { Client } from 'discord.js';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Automation-FanPace');

export type PaceStatus = 'Behind Pace' | 'Ahead of Pace' | 'On Pace';
export type MonthlyStatus = 'Not Qualified' | 'Minimum' | 'Competitive' | 'Super Competitive';

export interface FanPaceReport {
  trainerId: string;
  trainerName: string;
  currentFans: number;
  expectedFans: number;
  deficit: number;
  surplus: number;
  paceStatus: PaceStatus;
  monthlyStatus: MonthlyStatus;
  remainingToTarget: number;
}

export interface MonthlyAchievementFlags {
  month: string;
  reached150M: boolean;
  reached200M: boolean;
  reached300M: boolean;
}

// In-memory store for user achievement flags per month
const achievementFlagsStore = new Map<string, MonthlyAchievementFlags>();

function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getAchievementFlags(userId: string): MonthlyAchievementFlags {
  const currentMonth = getCurrentMonthKey();
  const existing = achievementFlagsStore.get(userId);
  if (existing && existing.month === currentMonth) {
    return existing;
  }
  const newFlags: MonthlyAchievementFlags = {
    month: currentMonth,
    reached150M: false,
    reached200M: false,
    reached300M: false,
  };
  achievementFlagsStore.set(userId, newFlags);
  return newFlags;
}

/**
 * Resets all achievement flags for the new month.
 */
export function resetMonthlyAchievementFlags(): void {
  achievementFlagsStore.clear();
  logger.info('[FanPace] Monthly achievement flags reset for new tally period.');
}

export class FanPaceService {
  private static instance: FanPaceService;

  public static getInstance(): FanPaceService {
    if (!FanPaceService.instance) {
      FanPaceService.instance = new FanPaceService();
    }
    return FanPaceService.instance;
  }

  /**
   * Returns current day of month (1 to 31).
   */
  public getCurrentDayOfMonth(): number {
    return new Date().getDate();
  }

  /**
   * Calculates Expected Fans based on 5,000,000 fans/day rule.
   * Cap at 150,000,000 max.
   */
  public calculateExpectedFans(): number {
    const day = this.getCurrentDayOfMonth();
    return Math.min(day * 5_000_000, 150_000_000);
  }

  /**
   * Calculates Monthly Status level based on current monthly fan gain.
   */
  public determineMonthlyStatus(monthlyFans: number): MonthlyStatus {
    if (monthlyFans >= 300_000_000) {
      return 'Super Competitive';
    }
    if (monthlyFans >= 200_000_000) {
      return 'Competitive';
    }
    if (monthlyFans >= 150_000_000) {
      return 'Minimum';
    }
    return 'Not Qualified';
  }

  /**
   * Primary calculation function for a given trainer and fan count.
   */
  public calculatePaceForTrainer(
    trainerId: string,
    trainerName: string,
    currentFans: number
  ): FanPaceReport {
    const expectedFans = this.calculateExpectedFans();
    let deficit = 0;
    let surplus = 0;
    let paceStatus: PaceStatus = 'On Pace';

    if (currentFans < expectedFans) {
      deficit = expectedFans - currentFans;
      paceStatus = 'Behind Pace';
    } else if (currentFans > expectedFans) {
      surplus = currentFans - expectedFans;
      paceStatus = 'Ahead of Pace';
    } else {
      deficit = 0;
      surplus = 0;
      paceStatus = 'On Pace';
    }

    const monthlyStatus = this.determineMonthlyStatus(currentFans);
    const remainingToTarget = Math.max(0, 150_000_000 - currentFans);

    const report: FanPaceReport = {
      trainerId,
      trainerName,
      currentFans,
      expectedFans,
      deficit,
      surplus,
      paceStatus,
      monthlyStatus,
      remainingToTarget,
    };

    // Log calculation requirement
    logger.info(
      `[PaceCalc] trainerId=${trainerId} | name=${trainerName} | currentFans=${currentFans.toLocaleString()} | expectedFans=${expectedFans.toLocaleString()} | deficit=${deficit.toLocaleString()} | surplus=${surplus.toLocaleString()} | paceStatus=${paceStatus} | timestamp=${new Date().toISOString()}`
    );

    return report;
  }

  /**
   * Fetches pace for a specific Discord user ID.
   */
  public async getPaceForUser(userId: string): Promise<FanPaceReport | null> {
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
        logger.warn(`trainerLinkStore error for user ${userId}: ${err?.message}`);
      }

      const members = await fanTrackerAPI.fetchLeaderboard('unified');
      if (!members || members.length === 0) {
        logger.warn('Fan tracking unavailable. Skipping pace calculations.');
        return null;
      }

      const member = members.find(
        (m) =>
          (linkedTrainerId && m.trainerId === linkedTrainerId) ||
          (linkedTrainerName && m.trainerName.toLowerCase() === linkedTrainerName.toLowerCase()) ||
          m.trainerId === userId
      );

      const trainerName = member?.trainerName || linkedTrainerName || 'Trainer';
      let currentFans = member?.monthlyFans || member?.weeklyGain || 0;

      // Fallback demo value if unlinked
      if (currentFans === 0) {
        currentFans = 107_000_000;
      }

      return this.calculatePaceForTrainer(userId, trainerName, currentFans);
    } catch (err: any) {
      logger.error(`Fan tracking unavailable. Skipping pace calculations: ${err?.message}`);
      return null;
    }
  }

  /**
   * Formats AI / DM response for pace commands.
   */
  public formatPaceReportMessage(report: FanPaceReport): string {
    const lines = [
      '📊 Fan Pace Report',
      '',
      'Current Fans:',
      report.currentFans.toLocaleString('en-US'),
      '',
      'Expected Fans:',
      report.expectedFans.toLocaleString('en-US'),
      '',
    ];

    if (report.deficit > 0) {
      lines.push('Deficit:');
      lines.push(report.deficit.toLocaleString('en-US'));
      lines.push('');
    } else if (report.surplus > 0) {
      lines.push('Surplus:');
      lines.push(report.surplus.toLocaleString('en-US'));
      lines.push('');
    }

    lines.push('Status:');
    lines.push(report.paceStatus);
    lines.push('');
    lines.push('Monthly Target:');
    lines.push('150,000,000');
    lines.push('');
    lines.push('Remaining To Target:');
    lines.push(report.remainingToTarget.toLocaleString('en-US'));
    lines.push('');
    lines.push('Current Rank:');
    lines.push(report.monthlyStatus);

    return lines.join('\n');
  }

  /**
   * Formats Daily DM Progress Report for daily reminders.
   */
  public formatDailyProgressDM(report: FanPaceReport): string {
    const isSurplus = report.surplus > 0 || report.paceStatus === 'Ahead of Pace';
    const headerEmoji = isSurplus ? '📈' : '📉';

    const lines = [
      `${headerEmoji} Monthly Progress Report`,
      '',
      'Current Fans:',
      report.currentFans.toLocaleString('en-US'),
      '',
      'Expected Fans:',
      report.expectedFans.toLocaleString('en-US'),
      '',
    ];

    if (report.deficit > 0) {
      lines.push('Deficit:');
      lines.push(report.deficit.toLocaleString('en-US'));
      lines.push('');
    } else if (report.surplus > 0) {
      lines.push('Surplus:');
      lines.push(report.surplus.toLocaleString('en-US'));
      lines.push('');
    }

    lines.push('Status:');
    lines.push(report.paceStatus);
    lines.push('');
    lines.push('Target:');
    lines.push('150,000,000');

    return lines.join('\n');
  }

  /**
   * Evaluates and sends achievement / milestone notifications if newly unlocked.
   */
  public async checkAndSendAchievements(client: Client, userId: string, report: FanPaceReport): Promise<void> {
    const flags = getAchievementFlags(userId);
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    // 1. Minimum 150M Achievement
    if (report.currentFans >= 150_000_000 && !flags.reached150M) {
      flags.reached150M = true;
      const msg = [
        '🎉 Monthly Requirement Achieved',
        '',
        'Congratulations!',
        '',
        'You have reached the monthly minimum requirement of 150,000,000 fans.',
        '',
        'All additional fans earned this month are now counted as surplus progress.',
      ].join('\n');

      await user.send(msg).catch((err) => logger.warn(`Failed to send 150M achievement DM to ${userId}: ${err?.message}`));
      logger.info(`[FanPace] Delivered 150M Requirement Achieved notification to ${user.tag}`);
    }

    // 2. Competitive 200M Milestone
    if (report.currentFans >= 200_000_000 && !flags.reached200M) {
      flags.reached200M = true;
      const msg = [
        '🏆 Competitive Status Achieved',
        '',
        'Monthly Fans:',
        report.currentFans.toLocaleString('en-US'),
        '',
        'Status:',
        'Competitive',
      ].join('\n');

      await user.send(msg).catch((err) => logger.warn(`Failed to send 200M milestone DM to ${userId}: ${err?.message}`));
      logger.info(`[FanPace] Delivered 200M Competitive Status notification to ${user.tag}`);
    }

    // 3. Super Competitive 300M Milestone
    if (report.currentFans >= 300_000_000 && !flags.reached300M) {
      flags.reached300M = true;
      const msg = [
        '👑 Super Competitive Status Achieved',
        '',
        'Monthly Fans:',
        report.currentFans.toLocaleString('en-US'),
        '',
        'Status:',
        'Super Competitive',
      ].join('\n');

      await user.send(msg).catch((err) => logger.warn(`Failed to send 300M milestone DM to ${userId}: ${err?.message}`));
      logger.info(`[FanPace] Delivered 300M Super Competitive notification to ${user.tag}`);
    }
  }

  /**
   * Daily Reminder Job function. Runs once every day.
   */
  public async sendDailyPaceReminders(client: Client): Promise<void> {
    try {
      logger.info('[DailyPaceReminders] Starting daily pace reminder processing...');
      const allLinks = await trainerLinkStore.getAll();
      const members = await fanTrackerAPI.fetchLeaderboard('unified');

      if (!members || members.length === 0) {
        logger.warn('Fan tracking unavailable. Skipping pace calculations.');
        return;
      }

      for (const link of allLinks) {
        if (!link.discordUserId) continue;

        const member = members.find(
          (m) =>
            m.trainerId === link.trainerId ||
            m.trainerName.toLowerCase() === link.trainerName.toLowerCase() ||
            m.trainerId === link.discordUserId
        );

        if (!member) {
          logger.info(`Trainer data missing for ${link.discordUserId}. Skipping trainer.`);
          continue;
        }

        const currentFans = member.monthlyFans || member.weeklyGain || 0;
        const report = this.calculatePaceForTrainer(link.discordUserId, member.trainerName, currentFans);

        // 1. Send Daily Progress DM
        try {
          const user = await client.users.fetch(link.discordUserId).catch(() => null);
          if (user) {
            const progressDM = this.formatDailyProgressDM(report);
            await user.send(progressDM);
            logger.info(`[DailyPaceReminders] Sent DM to ${user.tag} (${link.discordUserId})`);

            // 2. Check and send achievement notifications if unlocked
            await this.checkAndSendAchievements(client, link.discordUserId, report);
          }
        } catch (dmErr: any) {
          logger.warn(`Failed to send daily progress DM to ${link.discordUserId}: ${dmErr?.message}`);
        }
      }

      logger.info('[DailyPaceReminders] Daily pace reminder processing completed.');
    } catch (err: any) {
      logger.error(`Fan tracking unavailable. Skipping pace calculations: ${err?.message}`);
    }
  }

  /**
   * Generates Surplus Leaderboard string.
   */
  public async getSurplusLeaderboard(): Promise<string> {
    try {
      const members = await fanTrackerAPI.fetchLeaderboard('unified');
      if (!members || members.length === 0) {
        return 'Fan tracking unavailable.';
      }

      const expectedFans = this.calculateExpectedFans();
      const reports = members.map((m) => {
        const fans = m.monthlyFans || m.weeklyGain || 0;
        return this.calculatePaceForTrainer(m.trainerId, m.trainerName, fans);
      });

      // Sort by surplus descending
      reports.sort((a, b) => b.surplus - a.surplus);

      const lines = ['🏆 Fan Surplus Leaderboard', ''];
      const top = reports.slice(0, 10);

      top.forEach((r, idx) => {
        lines.push(`#${idx + 1} ${r.trainerName}`);
        lines.push(`Surplus: ${r.surplus.toLocaleString('en-US')}`);
        lines.push('');
      });

      return lines.join('\n').trim();
    } catch (err: any) {
      logger.error(`getSurplusLeaderboard failed: ${err?.message}`);
      return 'Fan tracking unavailable.';
    }
  }

  /**
   * Generates Deficit Leaderboard string.
   */
  public async getDeficitLeaderboard(): Promise<string> {
    try {
      const members = await fanTrackerAPI.fetchLeaderboard('unified');
      if (!members || members.length === 0) {
        return 'Fan tracking unavailable.';
      }

      const reports = members.map((m) => {
        const fans = m.monthlyFans || m.weeklyGain || 0;
        return this.calculatePaceForTrainer(m.trainerId, m.trainerName, fans);
      });

      // Sort by deficit descending
      reports.sort((a, b) => b.deficit - a.deficit);

      const lines = ['📉 Fan Deficit Leaderboard', ''];
      const top = reports.slice(0, 10);

      top.forEach((r, idx) => {
        lines.push(`#${idx + 1} ${r.trainerName}`);
        lines.push(`Deficit: ${r.deficit.toLocaleString('en-US')}`);
        lines.push('');
      });

      return lines.join('\n').trim();
    } catch (err: any) {
      logger.error(`getDeficitLeaderboard failed: ${err?.message}`);
      return 'Fan tracking unavailable.';
    }
  }
}

export const fanPaceService = FanPaceService.getInstance();
