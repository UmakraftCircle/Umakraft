import { createLogger } from '@ai-agent-platform/shared';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { fanPaceService } from './fan-pace.js';

const logger = createLogger('LilyTaskService');

export type ExplanationMode = 'quick' | 'detailed' | 'developer';

export interface TaskAnalysisResult {
  analysisType: 'goal_projection' | 'deficit_recovery' | 'milestone_advice' | 'leaderboard_analysis' | 'monthly_review' | 'general';
  summary: string;
  metrics: {
    currentFans?: number;
    targetFans?: number;
    remainingDays?: number;
    requiredDaily?: number;
    projectedCompletionRate?: number;
  };
  recommendation: string;
}

/**
 * LilyTaskService — Task Intelligence Engine for multi-step reasoning, fan projections,
 * deficit recovery planning, milestone advising, and leaderboard intelligence.
 */
export class LilyTaskService {
  private static instance: LilyTaskService;

  private constructor() {}

  public static getInstance(): LilyTaskService {
    if (!LilyTaskService.instance) {
      LilyTaskService.instance = new LilyTaskService();
    }
    return LilyTaskService.instance;
  }

  /**
   * Analyzes fan projection for reaching a target (e.g. 300M).
   */
  public async analyzeGoalProjection(userId: string, targetFans: number, mode: ExplanationMode = 'detailed'): Promise<TaskAnalysisResult> {
    try {
      const paceReport = await fanPaceService.getPaceForUser(userId).catch(() => null);
      const currentFans = paceReport?.currentFans || 0;
      
      const now = new Date();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const remainingDays = Math.max(1, lastDayOfMonth - now.getDate());

      const fanGap = Math.max(0, targetFans - currentFans);
      const requiredDaily = Math.ceil(fanGap / remainingDays);
      const projectedCompletionRate = Math.min(100, Math.round((currentFans / targetFans) * 100));

      let summary = `Trainer, based on your current progress (${(currentFans / 1_000_000).toFixed(1)}M fans), reaching ${(targetFans / 1_000_000).toFixed(1)}M fans requires gaining ${(fanGap / 1_000_000).toFixed(1)}M fans over the remaining ${remainingDays} days of the month.`;
      
      if (mode === 'detailed') {
        summary += ` This breaks down to an average of ${(requiredDaily / 1_000_000).toFixed(2)}M fans per day.`;
      } else if (mode === 'developer') {
        summary += ` [Dev Mode] Calculation: (Target: ${targetFans} - Current: ${currentFans}) / RemainingDays: ${remainingDays} = ${requiredDaily} fans/day.`;
      }

      const recommendation = fanGap === 0
        ? `You've already reached your goal, Trainer! Incredible work.`
        : `If you maintain a steady training pace of ${(requiredDaily / 1_000_000).toFixed(2)}M daily, you have a strong chance of hitting your target before the reset.`;

      return {
        analysisType: 'goal_projection',
        summary,
        metrics: { currentFans, targetFans, remainingDays, requiredDaily, projectedCompletionRate },
        recommendation,
      };
    } catch (err: any) {
      logger.error(`[LilyTaskService] analyzeGoalProjection error: ${err?.message}`);
      return {
        analysisType: 'goal_projection',
        summary: "I'm sorry, Trainer. I don't currently have enough information to perform that analysis.",
        metrics: {},
        recommendation: "Please try verifying your stats or try again later.",
      };
    }
  }

  /**
   * Analyzes deficit recovery planning.
   */
  public async analyzeDeficitRecovery(userId: string): Promise<TaskAnalysisResult> {
    try {
      const paceReport = await fanPaceService.getPaceForUser(userId).catch(() => null);
      const currentFans = paceReport?.currentFans || 0;
      const deficit = paceReport?.deficit || 0;

      const now = new Date();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const remainingDays = Math.max(1, lastDayOfMonth - now.getDate());
      const recoveryDaily = deficit > 0 ? Math.ceil(deficit / remainingDays) : 0;

      const summary = deficit > 0
        ? `Trainer, you're currently behind by ${(deficit / 1_000_000).toFixed(1)} million fans compared to the expected pace.`
        : `Trainer, you are currently ahead of schedule with no deficit!`;

      const recommendation = deficit > 0
        ? `To recover before the monthly reset, you'll need approximately ${(recoveryDaily / 1_000_000).toFixed(2)} additional fans per day over the next ${remainingDays} days.`
        : `Keep up the wonderful momentum, Trainer!`;

      return {
        analysisType: 'deficit_recovery',
        summary,
        metrics: { currentFans, remainingDays, requiredDaily: recoveryDaily },
        recommendation,
      };
    } catch (err: any) {
      logger.error(`[LilyTaskService] analyzeDeficitRecovery error: ${err?.message}`);
      return {
        analysisType: 'deficit_recovery',
        summary: "I'm sorry, Trainer. I couldn't retrieve your deficit data right now.",
        metrics: {},
        recommendation: "Please try again in a moment.",
      };
    }
  }

  /**
   * Analyzes leaderboard placement and gaps.
   */
  public async analyzeLeaderboardGap(userId: string, targetRank: number = 10): Promise<TaskAnalysisResult> {
    try {
      const members = await fanTrackerAPI.fetchLeaderboard('unified', true).catch(() => []);
      const sorted = [...members].sort((a, b) => (b.monthlyFans || 0) - (a.monthlyFans || 0));

      const userRankIndex = sorted.findIndex((m) => m.trainerId === userId || m.discordId === userId);

      if (userRankIndex < 0) {
        return {
          analysisType: 'leaderboard_analysis',
          summary: `Trainer, your entry is currently outside the top rankings or unlinked. Keep pushing your training!`,
          metrics: {},
          recommendation: "Focus on steady daily fan gains to climb into the rankings.",
        };
      }

      const userEntry = sorted[userRankIndex];
      const targetIndex = Math.max(0, targetRank - 1);
      const targetEntry = sorted[targetIndex];

      if (userRankIndex <= targetIndex) {
        return {
          analysisType: 'leaderboard_analysis',
          summary: `Congratulations, Trainer! You are currently ranked #${userRankIndex + 1}, which is already inside your target of Top ${targetRank}!`,
          metrics: { currentFans: userEntry.monthlyFans || 0 },
          recommendation: "Maintain your fantastic position!",
        };
      }

      const fanGap = (targetEntry.monthlyFans || 0) - (userEntry.monthlyFans || 0);
      const summary = `Trainer, you are currently ranked #${userRankIndex + 1}, which is ${(fanGap / 1_000_000).toFixed(1)} million fans behind #${targetRank} (${targetEntry.trainerName}).`;

      return {
        analysisType: 'leaderboard_analysis',
        summary,
        metrics: { currentFans: userEntry.monthlyFans || 0, targetFans: targetEntry.monthlyFans || 0 },
        recommendation: `If you increase your daily gain by a little each day, closing the gap to Top ${targetRank} is fully achievable!`,
      };
    } catch (err: any) {
      logger.error(`[LilyTaskService] analyzeLeaderboardGap error: ${err?.message}`);
      return {
        analysisType: 'leaderboard_analysis',
        summary: "I'm sorry, Trainer. I couldn't retrieve leaderboard gap information right now.",
        metrics: {},
        recommendation: "Please try again later.",
      };
    }
  }
}

export const lilyTaskService = LilyTaskService.getInstance();
