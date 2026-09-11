import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('InsightEngine');

export type InsightCategory =
  | 'PACE_IMPROVEMENT'
  | 'PACE_DECLINE'
  | 'MILESTONE_APPROACHING'
  | 'SURPLUS_OPPORTUNITY'
  | 'DEFICIT_RISK'
  | 'RANKING_CHANGE'
  | 'INACTIVE_TREND'
  | 'CLUB_TREND';

export type InsightPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface InsightRecord {
  insightId: string;
  trainerId: string;
  category: InsightCategory;
  priority: InsightPriority;
  message: string;
  timestamp: number;
  cooldownMs: number;
}

export class InsightEngine {
  private static instance: InsightEngine;
  private sentInsights: Map<string, number> = new Map(); // key: `${trainerId}:${category}` -> lastSentTimestamp

  public static getInstance(): InsightEngine {
    if (!InsightEngine.instance) {
      InsightEngine.instance = new InsightEngine();
    }
    return InsightEngine.instance;
  }

  /**
  * Evaluates trainer metrics and generates proactive insights with priority and cooldown protection.
  */
  public evaluateTrainerMetrics(metrics: {
    trainerId: string;
    trainerName: string;
    currentFans: number;
    targetFans: number;
    dailyGain: number;
    requiredDailyGain: number;
    currentRank: number;
    previousRank: number;
    consecutiveDaysBelowTarget: number;
  }): { insight?: InsightRecord; suppressed: boolean } {
    const {
      trainerId,
      trainerName,
      currentFans,
      targetFans,
      dailyGain,
      requiredDailyGain,
      currentRank,
      previousRank,
      consecutiveDaysBelowTarget,
    } = metrics;

    let category: InsightCategory | undefined;
    let priority: InsightPriority = 'MEDIUM';
    let message = '';
    let cooldownMs = 24 * 60 * 60 * 1000; // default 24h

    // 1. Deficit Risk Detection (Critical)
    if (consecutiveDaysBelowTarget >= 3) {
      category = 'DEFICIT_RISK';
      priority = 'CRITICAL';
      cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
      message = `Trainer ${trainerName}, your average gain over the past three days has fallen below the pace required to reach ${(targetFans / 1e6).toFixed(0)}M this month. Increasing your daily gain during the coming week should help close the gap.`;
    }
    // 2. Surplus Opportunity Detection (High)
    else if (dailyGain >= requiredDailyGain * 1.2) {
      category = 'SURPLUS_OPPORTUNITY';
      priority = 'HIGH';
      cooldownMs = 48 * 60 * 60 * 1000; // 48 hours
      message = `Trainer ${trainerName}, your current average fan gain is 22% above the pace required for ${(targetFans / 1e6).toFixed(0)}M. Would you like me to calculate a stretch goal?`;
    }
    // 3. Ranking Change / Opportunity Detection (Medium)
    else if (currentRank < previousRank) {
      category = 'RANKING_CHANGE';
      priority = 'MEDIUM';
      cooldownMs = 48 * 60 * 60 * 1000; // 48 hours
      message = `Trainer ${trainerName}, I noticed you've moved up from rank #${previousRank} to #${currentRank} this week! Keep up the strong momentum.`;
    }

    if (!category) {
      return { suppressed: false };
    }

    // Cooldown Protection Check
    const cooldownKey = `${trainerId}:${category}`;
    const lastSent = this.sentInsights.get(cooldownKey) ?? 0;
    const now = Date.now();

    if (now - lastSent < cooldownMs) {
      logger.info(`[Insight Suppressed] Cooldown active for trainer ${trainerId} category ${category}.`);
      return { suppressed: true };
    }

    // Record insight and update cooldown
    this.sentInsights.set(cooldownKey, now);
    const insightId = `ins_${trainerId}_${now}`;

    const record: InsightRecord = {
      insightId,
      trainerId,
      category,
      priority,
      message,
      timestamp: now,
      cooldownMs,
    };

    logger.info(`[Proactive Insight Generated] ID: ${insightId} | Category: ${category} | Priority: ${priority}`);
    return { insight: record, suppressed: false };
  }

  /**
  * Generates a daily intelligence digest summary.
  */
  public generateDailyDigest(data: {
    trainerName: string;
    currentFans: number;
    targetFans: number;
    dailyGain: number;
    requiredDailyGain: number;
    rank: number;
    rankDelta: number;
  }): string {
    const { trainerName, currentFans, targetFans, dailyGain, requiredDailyGain, rank, rankDelta } = data;
    const fanDiff = dailyGain - requiredDailyGain;
    const paceStatus = fanDiff >= 0 ? `Ahead by ${(fanDiff / 1e6).toFixed(1)}M` : `Behind by ${(Math.abs(fanDiff) / 1e6).toFixed(1)}M`;
    const rankTrend = rankDelta > 0 ? `(+${rankDelta} since yesterday)` : rankDelta < 0 ? `(${rankDelta} since yesterday)` : '(unchanged)';
    const remaining = Math.max(0, targetFans - currentFans);

    return (
      `Good morning, ${trainerName}!\n\n` +
      `Today's Intelligence Summary:\n` +
      `• Current Fan Total: ${(currentFans / 1e6).toFixed(1)}M\n` +
      `• Pace Status: ${paceStatus}\n` +
      `• Ranking: #${rank} ${rankTrend}\n` +
      `• Next Milestone: ${(targetFans / 1e6).toFixed(0)}M (${(remaining / 1e6).toFixed(1)}M remaining)\n\n` +
      `Keep up the strong momentum! 🐎`
    );
  }

  public clearCooldowns(): void {
    this.sentInsights.clear();
  }
}

export const insightEngine = InsightEngine.getInstance();
