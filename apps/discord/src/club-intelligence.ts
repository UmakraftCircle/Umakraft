import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ClubIntelligenceEngine');

export type ClubHealthStatus = 'GOOD' | 'WARNING' | 'CRITICAL';
export type PaceStatus = 'AHEAD' | 'ON_TRACK' | 'BEHIND';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type MomentumStatus = 'POSITIVE' | 'STABLE' | 'NEGATIVE';

export interface ClubMemberRecord {
  trainerId: string;
  trainerName: string;
  currentFans: number;
  targetFans: number;
  dailyGain: number;
  weeklyGain: number;
  previousWeeklyGain: number;
}

export interface ClubIntelligenceReport {
  clubHealth: ClubHealthStatus;
  pace: PaceStatus;
  riskLevel: RiskLevel;
  momentum: MomentumStatus;
  totalClubFans: number;
  projectedMonthEndTotal: number;
  activeMembers: number;
  atRiskMembersCount: number;
  topContributor: { trainerName: string; fans: number };
  atRiskMembers: string[];
  recommendedAction: string;
  milestoneForecastDays?: number;
}

export class ClubIntelligenceEngine {
  private static instance: ClubIntelligenceEngine;

  public static getInstance(): ClubIntelligenceEngine {
    if (!ClubIntelligenceEngine.instance) {
      ClubIntelligenceEngine.instance = new ClubIntelligenceEngine();
    }
    return ClubIntelligenceEngine.instance;
  }

  /**
  * Generates a comprehensive Club Intelligence Report based on member records and days remaining in the month.
  */
  public generateReport(members: ClubMemberRecord[], daysRemaining: number, monthlyTarget: number): ClubIntelligenceReport {
    let totalClubFans = 0;
    let totalDailyGain = 0;
    let activeMembers = 0;
    const atRiskMembers: string[] = [];
    let topContributor = { trainerName: 'None', fans: 0 };

    let totalCurrentWeeklyGain = 0;
    let totalPreviousWeeklyGain = 0;

    for (const m of members) {
      totalClubFans += m.currentFans;
      totalDailyGain += m.dailyGain;
      totalCurrentWeeklyGain += m.weeklyGain;
      totalPreviousWeeklyGain += m.previousWeeklyGain;

      if (m.currentFans > 0) {
        activeMembers++;
      }

      if (m.currentFans > topContributor.fans) {
        topContributor = { trainerName: m.trainerName, fans: m.currentFans };
      }

      // Member risk check (projected month-end vs target)
      const projectedMemberFans = m.currentFans + m.dailyGain * daysRemaining;
      if (projectedMemberFans < m.targetFans) {
        atRiskMembers.push(m.trainerName);
      }
    }

    // Forecasting
    const projectedMonthEndTotal = totalClubFans + totalDailyGain * daysRemaining;
    const requiredDailyGain = (monthlyTarget - totalClubFans) / Math.max(1, daysRemaining);

    // Pace & Health Assessment
    let pace: PaceStatus = 'ON_TRACK';
    if (totalDailyGain >= requiredDailyGain * 1.1) {
      pace = 'AHEAD';
    } else if (totalDailyGain < requiredDailyGain * 0.9) {
      pace = 'BEHIND';
    }

    let clubHealth: ClubHealthStatus = 'GOOD';
    let riskLevel: RiskLevel = 'LOW';
    if (pace === 'BEHIND' || atRiskMembers.length > members.length * 0.3) {
      clubHealth = 'WARNING';
      riskLevel = 'MEDIUM';
    }
    if (projectedMonthEndTotal < monthlyTarget * 0.85 || atRiskMembers.length > members.length * 0.5) {
      clubHealth = 'CRITICAL';
      riskLevel = 'HIGH';
    }

    // Momentum Analysis
    let momentum: MomentumStatus = 'STABLE';
    if (totalCurrentWeeklyGain > totalPreviousWeeklyGain * 1.05) {
      momentum = 'POSITIVE';
    } else if (totalCurrentWeeklyGain < totalPreviousWeeklyGain * 0.95) {
      momentum = 'NEGATIVE';
    }

    // Milestone Forecast (e.g. reaching 5B or monthlyTarget)
    let milestoneForecastDays: number | undefined;
    if (totalDailyGain > 0 && totalClubFans < monthlyTarget) {
      milestoneForecastDays = Math.ceil((monthlyTarget - totalClubFans) / totalDailyGain);
    }

    // Strategic Intervention Recommendation
    let recommendedAction = 'Club momentum is stable. Maintain current training schedules.';
    if (atRiskMembers.length > 0) {
      recommendedAction = `Club is projected to have ${atRiskMembers.length} member(s) below target. Focusing support and training tips on ${atRiskMembers.slice(0, 2).join(' and ')} would recover the majority of the projected deficit.`;
    }

    logger.info(`[Club Intelligence] Generated report. Health: ${clubHealth} | Projected: ${projectedMonthEndTotal}`);

    return {
      clubHealth,
      pace,
      riskLevel,
      momentum,
      totalClubFans,
      projectedMonthEndTotal,
      activeMembers,
      atRiskMembersCount: atRiskMembers.length,
      topContributor,
      atRiskMembers,
      recommendedAction,
      milestoneForecastDays,
    };
  }
}

export const clubIntelligenceEngine = ClubIntelligenceEngine.getInstance();
