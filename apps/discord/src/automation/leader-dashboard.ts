import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { createLogger } from '@ai-agent-platform/shared';
import { fanIntelligenceEngine, type FanIntelligenceMetrics } from './fan-intelligence.js';
import { linkRequestService } from './link-request.js';

const logger = createLogger('LeaderDashboard');

export interface ClubLeaderDashboardData {
  timestamp: string;
  totalTrainers: number;
  linkedTrainers: number;
  activeTrainers: number;
  inactiveTrainers: number;
  clubTotalFans: number;
  clubHealthScore: number; // 0 to 100
  milestones: {
    m150: number; // Minimum
    m200: number; // Competitive
    m300: number; // Super Competitive
  };
  deficits: FanIntelligenceMetrics[];
  surpluses: FanIntelligenceMetrics[];
  recruitment: {
    unlinkedMembers: number;
    pendingLinkRequests: number;
    inactiveCount: number;
  };
}

export class ClubLeaderDashboardService {
  private static instance: ClubLeaderDashboardService;

  public static getInstance(): ClubLeaderDashboardService {
    if (!ClubLeaderDashboardService.instance) {
      ClubLeaderDashboardService.instance = new ClubLeaderDashboardService();
    }
    return ClubLeaderDashboardService.instance;
  }

  /**
   * Evaluates complete Club Intelligence Dashboard data.
   */
  public async getDashboardData(): Promise<ClubLeaderDashboardData> {
    const members = (await fanTrackerAPI.fetchAllMembers()) || [];
    const links = await trainerLinkStore.getAll();
    const pendingLinks = await linkRequestService.getPendingRequests();

    let clubTotalFans = 0;
    let activeCount = 0;
    let inactiveCount = 0;
    let m150 = 0;
    let m200 = 0;
    let m300 = 0;

    const allMetrics: FanIntelligenceMetrics[] = [];

    for (const m of members) {
      const fans = m.monthlyFans || m.weeklyGain || 0;
      clubTotalFans += fans;

      if (fans > 0) activeCount++;
      else inactiveCount++;

      if (fans >= 300_000_000) m300++;
      else if (fans >= 200_000_000) m200++;
      else if (fans >= 150_000_000) m150++;

      const metric = fanIntelligenceEngine.calculateMetrics(m.trainerId, m.trainerName, fans);
      allMetrics.push(metric);
    }

    // Sort Deficits & Surpluses
    const deficits = allMetrics.filter((x) => x.deficit > 0).sort((a, b) => b.deficit - a.deficit);
    const surpluses = allMetrics.filter((x) => x.surplus > 0).sort((a, b) => b.surplus - a.surplus);

    // Calculate Club Health Score (0-100)
    const participationScore = members.length > 0 ? (links.length / members.length) * 30 : 25;
    const milestoneScore = members.length > 0 ? ((m150 + m200 + m300) / members.length) * 40 : 30;
    const deficitDeduction = members.length > 0 ? (deficits.length / members.length) * 20 : 0;
    const activityScore = members.length > 0 ? (activeCount / members.length) * 30 : 25;

    const rawHealthScore = Math.round(participationScore + milestoneScore + activityScore - deficitDeduction);
    const clubHealthScore = Math.max(0, Math.min(100, rawHealthScore));

    const dashboard: ClubLeaderDashboardData = {
      timestamp: new Date().toISOString(),
      totalTrainers: members.length,
      linkedTrainers: links.length,
      activeTrainers: activeCount,
      inactiveTrainers: inactiveCount,
      clubTotalFans,
      clubHealthScore,
      milestones: { m150, m200, m300 },
      deficits,
      surpluses,
      recruitment: {
        unlinkedMembers: Math.max(0, members.length - links.length),
        pendingLinkRequests: pendingLinks.length,
        inactiveCount,
      },
    };

    logger.info(`[LeaderDashboard] Club Health: ${clubHealthScore}/100 | Total Fans: ${clubTotalFans.toLocaleString()}`);
    return dashboard;
  }

  /**
   * Formats !club-health / Club Health Report.
   */
  public async formatClubHealthReport(): Promise<string> {
    const d = await this.getDashboardData();
    const formatM = (n: number) => (n / 1_000_000).toFixed(1);

    return [
      '👑 **UmaKraft Club Intelligence & Health Report (`!club-health`)**',
      '—'.repeat(28),
      `• **Club Health Score:** **${d.clubHealthScore}/100** ${d.clubHealthScore >= 80 ? '🟢 Excellent' : d.clubHealthScore >= 60 ? '🟡 Healthy' : '🔴 Action Required'}`,
      `• **Total Monthly Fans:** **${formatM(d.clubTotalFans)}M** Fans`,
      `• **Active Member Ratio:** ${d.activeTrainers}/${d.totalTrainers} (${Math.round((d.activeTrainers / Math.max(1, d.totalTrainers)) * 100)}% Active)`,
      `• **Linked Discord Accounts:** ${d.linkedTrainers}/${d.totalTrainers}`,
      '',
      '📊 **Milestone Tier Distribution:**',
      `  - 🏆 **300M Super Competitive:** ${d.milestones.m300} trainers`,
      `  - 🔥 **200M Competitive:** ${d.milestones.m200} trainers`,
      `  - 🎉 **150M Minimum:** ${d.milestones.m150} trainers`,
      '',
      '🚨 **Risk & Recruitment Status:**',
      `  - **Trainers Facing Deficit:** ${d.deficits.length} trainers`,
      `  - **Unlinked Club Members:** ${d.recruitment.unlinkedMembers} members`,
      `  - **Pending Link Requests:** ${d.recruitment.pendingLinkRequests} requests queue`,
    ].join('\n');
  }

  /**
   * Formats !risk-report / At-Risk Deficit Trainers Report.
   */
  public async formatRiskReport(): Promise<string> {
    const d = await this.getDashboardData();
    const formatM = (n: number) => (n / 1_000_000).toFixed(1);

    if (d.deficits.length === 0) {
      return '🟢 **Risk Report:** All active club trainers are currently on pace or in surplus status!';
    }

    const lines = [
      '⚠️ **UmaKraft At-Risk Deficit Trainers Report (`!risk-report`)**',
      '—'.repeat(28),
      `Total Trainers Facing Deficit: **${d.deficits.length}**`,
      '',
    ];

    d.deficits.slice(0, 10).forEach((def, idx) => {
      const riskEmoji = def.riskLevel === 'Red' ? '🔴' : def.riskLevel === 'Orange' ? '🟠' : '🟡';
      lines.push(`${idx + 1}. ${riskEmoji} **${def.trainerName}** — Deficit: **${formatM(def.deficit)}M** | Daily Needed: **${formatM(def.requiredDailyGain)}M** (Avg: ${formatM(def.recentDailyAvg)}M/day)`);
    });

    return lines.join('\n');
  }

  /**
   * Formats !milestone-report / Milestone Analytics.
   */
  public async formatMilestoneReport(): Promise<string> {
    const d = await this.getDashboardData();

    return [
      '🏆 **UmaKraft Club Milestone Distribution (`!milestone-report`)**',
      '—'.repeat(28),
      `• **300M Super Competitive Tier:** **${d.milestones.m300}** Trainers`,
      `• **200M Competitive Tier:** **${d.milestones.m200}** Trainers`,
      `• **150M Minimum Tier:** **${d.milestones.m150}** Trainers`,
      `• **Below 150M Threshold:** **${Math.max(0, d.totalTrainers - (d.milestones.m150 + d.milestones.m200 + d.milestones.m300))}** Trainers`,
      '',
      `💡 **Goal Completion Rate:** **${Math.round(((d.milestones.m150 + d.milestones.m200 + d.milestones.m300) / Math.max(1, d.totalTrainers)) * 100)}%** of club members qualified for monthly milestone status!`,
    ].join('\n');
  }

  /**
   * Formats !link-report / Link Requests & Oversight.
   */
  public async formatLinkReport(): Promise<string> {
    const d = await this.getDashboardData();
    const pending = await linkRequestService.getPendingRequests();

    const lines = [
      '📋 **Trainer Account Linking Oversight (`!link-report`)**',
      '—'.repeat(28),
      `• **Linked Trainers:** ${d.linkedTrainers} / ${d.totalTrainers}`,
      `• **Unlinked Club Members:** ${d.recruitment.unlinkedMembers}`,
      `• **Pending Link Requests:** ${d.recruitment.pendingLinkRequests}`,
      '',
    ];

    if (pending.length > 0) {
      lines.push('⏳ **Pending Queue:**');
      pending.forEach((req) => {
        lines.push(`  • <@${req.discordUserId}> → Trainer ID \`${req.trainerId}\``);
      });
    } else {
      lines.push('✅ No pending link requests in queue.');
    }

    return lines.join('\n');
  }

  /**
   * Formats Weekly AI Performance Summary Report for Club Leaders.
   */
  public async formatWeeklyClubReport(): Promise<string> {
    const d = await this.getDashboardData();
    const formatM = (n: number) => (n / 1_000_000).toFixed(1);

    const topGainers = d.surpluses.slice(0, 3).map((s) => `\`${s.trainerName}\` (+${formatM(s.surplus)}M Surplus)`).join(', ') || 'None';

    return [
      '📰 **Weekly AI Club Performance Summary (`!club-report`)**',
      '—'.repeat(28),
      `• **Overall Club Health:** **${d.clubHealthScore}/100**`,
      `• **Total Monthly Gain:** **${formatM(d.clubTotalFans)}M** Fans`,
      `• **Top Performers:** ${topGainers}`,
      `• **Deficit Recovery Alert:** ${d.deficits.length} trainers currently need coaching support.`,
      `• **Milestone Qualifiers:** ${d.milestones.m150 + d.milestones.m200 + d.milestones.m300} / ${d.totalTrainers} members`,
      '',
      'Use `!risk-report` to view individual trainer deficit recovery plans.',
    ].join('\n');
  }
}

export const clubLeaderDashboardService = ClubLeaderDashboardService.getInstance();
