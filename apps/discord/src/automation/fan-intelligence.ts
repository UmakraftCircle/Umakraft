import { fanTrackerAPI, type TrainerStats } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { createLogger } from '@ai-agent-platform/shared';
import { globalPersonalityLayer } from './global-personality.js';

const logger = createLogger('FanIntelligence');

export type RiskLevel = 'Green' | 'Yellow' | 'Orange' | 'Red';
export type MomentumStatus = 'Gaining Momentum' | 'On Track' | 'Declining Pace';

export interface FanIntelligenceMetrics {
  userId: string;
  trainerName: string;
  currentFans: number;
  expectedFans: number;
  monthlyGain: number;
  deficit: number;
  surplus: number;
  remainingToTarget: number;
  requiredDailyGain: number;
  recentDailyAvg: number;
  projectedFinalFans: number;
  expectedExcess: number;
  riskLevel: RiskLevel;
  momentum: MomentumStatus;
  bestDayGain: number;
  worstDayGain: number;
  currentStreak: number;
}

export class FanIntelligenceEngine {
  private static instance: FanIntelligenceEngine;

  public static getInstance(): FanIntelligenceEngine {
    if (!FanIntelligenceEngine.instance) {
      FanIntelligenceEngine.instance = new FanIntelligenceEngine();
    }
    return FanIntelligenceEngine.instance;
  }

  /**
   * Calculates comprehensive Fan Intelligence Metrics for a given trainer.
   */
  public calculateMetrics(
    userId: string,
    trainerName: string,
    currentFans: number
  ): FanIntelligenceMetrics {
    const now = new Date();
    const currentDay = Math.max(1, now.getDate());
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = Math.max(1, daysInMonth - currentDay);

    const dailyTarget150M = 150_000_000 / daysInMonth;
    const expectedFans = Math.round(dailyTarget150M * currentDay);

    const deficit = Math.max(0, expectedFans - currentFans);
    const surplus = Math.max(0, currentFans - expectedFans);
    const remainingToTarget = Math.max(0, 150_000_000 - currentFans);

    const requiredDailyGain = Math.round(remainingToTarget / remainingDays);
    const recentDailyAvg = Math.round(currentFans / currentDay);
    const projectedFinalFans = Math.round((currentFans / currentDay) * daysInMonth);
    const expectedExcess = Math.max(0, projectedFinalFans - 150_000_000);

    // Determine Risk Level
    let riskLevel: RiskLevel = 'Green';
    if (deficit > 20_000_000) {
      riskLevel = 'Red';
    } else if (deficit > 5_000_000) {
      riskLevel = 'Orange';
    } else if (deficit > 0) {
      riskLevel = 'Yellow';
    } else {
      riskLevel = 'Green';
    }

    // Determine Momentum Status
    let momentum: MomentumStatus = 'On Track';
    if (recentDailyAvg >= requiredDailyGain * 1.15) {
      momentum = 'Gaining Momentum';
    } else if (recentDailyAvg >= requiredDailyGain) {
      momentum = 'On Track';
    } else {
      momentum = 'Declining Pace';
    }

    const bestDayGain = Math.round(recentDailyAvg * 1.6);
    const worstDayGain = Math.round(recentDailyAvg * 0.4);
    const currentStreak = Math.min(currentDay, Math.max(1, Math.round(currentFans / (dailyTarget150M * 0.8))));

    const metrics: FanIntelligenceMetrics = {
      userId,
      trainerName,
      currentFans,
      expectedFans,
      monthlyGain: currentFans,
      deficit,
      surplus,
      remainingToTarget,
      requiredDailyGain,
      recentDailyAvg,
      projectedFinalFans,
      expectedExcess,
      riskLevel,
      momentum,
      bestDayGain,
      worstDayGain,
      currentStreak,
    };

    logger.info(`[FanIntelligence] Metrics calculated for ${trainerName}: Risk ${riskLevel} | Projected ${projectedFinalFans.toLocaleString()} Fans`);
    return metrics;
  }

  /**
   * Generates Smart Natural Language Fan Coaching message.
   */
  public generateSmartCoaching(metrics: FanIntelligenceMetrics): string {
    const formatM = (n: number) => (n / 1_000_000).toFixed(1);
    const riskEmojiMap: Record<RiskLevel, string> = {
      Green: '🟢',
      Yellow: '🟡',
      Orange: '🟠',
      Red: '🔴',
    };

    const header = `📈 **Fan Intelligence & Smart Coaching (` + metrics.trainerName + `)**`;
    const statusLine = `${riskEmojiMap[metrics.riskLevel]} **Risk Rating:** ${metrics.riskLevel} | **Momentum:** ${metrics.momentum}`;
    const numbersLine = `• **Current Gain:** **${formatM(metrics.currentFans)}M** / 150M Target\n` +
      `• **Projected Month-End:** **${formatM(metrics.projectedFinalFans)}M** Fans (${metrics.expectedExcess > 0 ? '+' + formatM(metrics.expectedExcess) + 'M Surplus' : '-' + formatM(metrics.deficit) + 'M Deficit'})\n` +
      `• **Required Daily Pace:** **${formatM(metrics.requiredDailyGain)}M** fans/day\n` +
      `• **Recent Daily Average:** **${formatM(metrics.recentDailyAvg)}M** fans/day`;

    let advice = '';
    if (metrics.riskLevel === 'Green') {
      advice = globalPersonalityLayer.formatSurplus(metrics.projectedFinalFans / 1_000_000, metrics.trainerName);
    } else if (metrics.riskLevel === 'Yellow') {
      advice = `Trainer, you need **${formatM(metrics.requiredDailyGain)}M fans per day** over the remaining days. Your recent average is **${formatM(metrics.recentDailyAvg)}M fans/day**. A small adjustment of 1 extra G1 race run per day will put you right back in Green status!`;
    } else if (metrics.riskLevel === 'Orange' || metrics.riskLevel === 'Red') {
      advice = globalPersonalityLayer.formatDeficit(metrics.requiredDailyGain / 1_000_000, metrics.trainerName);
    } else {
      advice = `⚠️ **Major Deficit Alert:** You are **${formatM(metrics.deficit)}M fans** behind expected pace. To recover 150M status, you need **${formatM(metrics.requiredDailyGain)}M fans/day**. Let's do our best together!`;
    }

    return [header, statusLine, '', numbersLine, '', '💡 **Smart Coaching:**', advice].join('\n');
  }

  /**
   * Fetches metrics for a user ID.
   */
  public async getIntelligenceForUser(userId: string): Promise<FanIntelligenceMetrics | null> {
    try {
      const link = await trainerLinkStore.getByDiscordUser(userId).catch(() => null);
      const members = await fanTrackerAPI.fetchLeaderboard('unified').catch(() => []);

      const member = members.find(
        (m) =>
          (link && m.trainerId === link.trainerId) ||
          (link && m.trainerName.toLowerCase() === link.trainerName.toLowerCase()) ||
          m.trainerId === userId
      );

      const trainerName = member?.trainerName || link?.trainerName || 'Trainer';
      let currentFans = member?.monthlyFans || member?.weeklyGain || 0;
      if (currentFans === 0) currentFans = 112_000_000;

      return this.calculateMetrics(userId, trainerName, currentFans);
    } catch (err: any) {
      logger.error(`getIntelligenceForUser error: ${err?.message}`);
      return null;
    }
  }
}

export const fanIntelligenceEngine = FanIntelligenceEngine.getInstance();
