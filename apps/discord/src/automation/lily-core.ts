import { createLogger } from '@ai-agent-platform/shared';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { fanPaceService } from './fan-pace.js';
import { lilyMemoryService } from './lily-memory-service.js';
import { trainerMemoryStore } from './trainer-memory.js';

const logger = createLogger('LilyCore');

export interface ClubIntelligenceSummary {
  totalClubFans: number;
  activeMemberCount: number;
  membersBehindPace: number;
  membersAheadOfPace: number;
  superCompetitiveCount: number;
  competitiveCount: number;
  minimumCount: number;
  unqualifiedCount: number;
  riskAlerts: string[];
  opportunityAlerts: string[];
  generatedAt: string;
}

/**
 * LilyCore — Autonomous Club Intelligence Master Coordinator (Phase 10).
 * Coordinates club awareness, risk detection, opportunity detection, leadership support,
 * and unified intelligence reporting.
 */
export class LilyCore {
  private static instance: LilyCore;

  private constructor() {}

  public static getInstance(): LilyCore {
    if (!LilyCore.instance) {
      LilyCore.instance = new LilyCore();
    }
    return LilyCore.instance;
  }

  /**
   * Generates a comprehensive Club Intelligence Summary across all members.
   */
  public async generateClubIntelligenceSummary(): Promise<ClubIntelligenceSummary> {
    try {
      logger.info('[LilyCore] Generating comprehensive Club Intelligence Summary...');
      const members = await fanTrackerAPI.fetchLeaderboard('unified', true).catch(() => []);

      let totalClubFans = 0;
      let membersBehindPace = 0;
      let membersAheadOfPace = 0;
      let superCompetitiveCount = 0;
      let competitiveCount = 0;
      let minimumCount = 0;
      let unqualifiedCount = 0;

      const riskAlerts: string[] = [];
      const opportunityAlerts: string[] = [];

      for (const m of members) {
        const fans = m.monthlyFans || m.totalFans || 0;
        totalClubFans += fans;

        const pace = fanPaceService.calculatePaceForTrainer(m.trainerId || m.discordId || 'unknown', m.trainerName, fans);

        if (pace.paceStatus === 'Behind Pace') {
          membersBehindPace++;
          if (pace.deficit > 20_000_000) {
            riskAlerts.push(`Trainer ${m.trainerName} is significantly behind pace by ${(pace.deficit / 1_000_000).toFixed(1)}M fans.`);
          }
        } else if (pace.paceStatus === 'Ahead of Pace') {
          membersAheadOfPace++;
        }

        if (pace.monthlyStatus === 'Super Competitive') superCompetitiveCount++;
        else if (pace.monthlyStatus === 'Competitive') {
          competitiveCount++;
          if (fans < 210_000_000) {
            opportunityAlerts.push(`Trainer ${m.trainerName} is close to the 300M Super Competitive milestone!`);
          }
        } else if (pace.monthlyStatus === 'Minimum') {
          minimumCount++;
          if (fans < 160_000_000) {
            opportunityAlerts.push(`Trainer ${m.trainerName} is approaching the 200M Competitive milestone.`);
          }
        } else {
          unqualifiedCount++;
        }
      }

      return {
        totalClubFans,
        activeMemberCount: members.length,
        membersBehindPace,
        membersAheadOfPace,
        superCompetitiveCount,
        competitiveCount,
        minimumCount,
        unqualifiedCount,
        riskAlerts,
        opportunityAlerts,
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error(`[LilyCore] Failed to generate Club Intelligence Summary: ${err?.message}`);
      return {
        totalClubFans: 0,
        activeMemberCount: 0,
        membersBehindPace: 0,
        membersAheadOfPace: 0,
        superCompetitiveCount: 0,
        competitiveCount: 0,
        minimumCount: 0,
        unqualifiedCount: 0,
        riskAlerts: [],
        opportunityAlerts: [],
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Generates a natural Lily-voiced Daily Club Report.
   */
  public async generateDailyReport(): Promise<string> {
    const summary = await this.generateClubIntelligenceSummary();
    const formattedFans = (summary.totalClubFans / 1_000_000).toFixed(1);

    return [
      `### 🌸 Lily's Daily Club Intelligence Report`,
      `Good day, Trainers! Here is the latest operational summary for UmaKraft:`,
      `• **Total Club Fan Gain**: ${formattedFans} million fans across ${summary.activeMemberCount} active members.`,
      `• **Milestone Distribution**: ${summary.superCompetitiveCount} Super Competitive, ${summary.competitiveCount} Competitive, and ${summary.minimumCount} Minimum qualifiers.`,
      `• **Pace Overview**: ${summary.membersAheadOfPace} Trainers ahead of pace, with ${summary.membersBehindPace} needing a little extra support.`,
      summary.riskAlerts.length > 0 ? `• **Risk Notice**: ${summary.riskAlerts[0]}` : '',
      summary.opportunityAlerts.length > 0 ? `• **Opportunity**: ${summary.opportunityAlerts[0]}` : '',
      ``,
      `Let's keep moving forward together, Trainers! Every step counts toward our victory. 🐎`,
    ].filter(Boolean).join('\n');
  }

  /**
   * Generates a personal intelligent diagnostic report for an individual Trainer.
   */
  public async generateTrainerDashboard(userId: string): Promise<string> {
    const pace = await fanPaceService.getPaceForUser(userId).catch(() => null);
    const perm = trainerMemoryStore.getPermanentMemory(userId);
    const work = trainerMemoryStore.getWorkingMemory(userId);
    const trainerName = perm.trainerName || 'Trainer';

    if (!pace) {
      return `I couldn't locate your club records right now, ${trainerName}. Make sure your account is linked!`;
    }

    return [
      `### 📋 Personal Intelligence Dashboard for ${trainerName}`,
      `• **Current Monthly Fans**: ${(pace.currentFans / 1_000_000).toFixed(1)}M (${pace.monthlyStatus})`,
      `• **Pace Status**: ${pace.paceStatus} (Expected: ${(pace.expectedFans / 1_000_000).toFixed(1)}M)`,
      pace.deficit > 0 ? `• **Deficit**: ${(pace.deficit / 1_000_000).toFixed(1)}M fans behind pace` : '',
      pace.surplus > 0 ? `• **Surplus**: ${(pace.surplus / 1_000_000).toFixed(1)}M fans ahead of pace!` : '',
      work.activeGoals.length > 0 ? `• **Active Goals**: ${work.activeGoals.join(', ')}` : '',
      ``,
      `*Lily's Recommendation*: ${pace.deficit > 0 ? 'Let\'s pick up the training pace slightly over the next few days to close the gap!' : 'You are doing wonderfully! Keep up the brilliant momentum.'}`,
    ].filter(Boolean).join('\n');
  }
}

export const lilyCore = LilyCore.getInstance();
