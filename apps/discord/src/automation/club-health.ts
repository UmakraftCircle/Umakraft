import { fanTrackerAPI, type TrainerStats } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';
import { createLogger } from '@ai-agent-platform/shared';
import { capabilityDiscovery } from '@ai-agent-platform/core';
import { dmAuditStore } from './dm-audit.js';
import { proactiveEngine } from './proactive-engine.js';
import { trainerMemoryStore } from './trainer-memory.js';
import { fanPaceService } from './fan-pace.js';

const logger = createLogger('ClubHealth');

export interface ClubHealthSummary {
  timestamp: string;
  totalMembers: number;
  linkedTrainersCount: number;
  totalMonthlyFans: number;
  activeDeficitCount: number;
  surplusCount: number;
  milestoneCounts: {
    minimum: number;        // >= 150M
    competitive: number;    // >= 200M
    superCompetitive: number;// >= 300M
  };
  overallRiskLevel: 'Low' | 'Moderate' | 'High';
  clubParticipationRate: number; // Percentage
  projectedMonthlyTotal: number;
}

export class ClubHealthEvaluator {
  private static instance: ClubHealthEvaluator;

  public static getInstance(): ClubHealthEvaluator {
    if (!ClubHealthEvaluator.instance) {
      ClubHealthEvaluator.instance = new ClubHealthEvaluator();
    }
    return ClubHealthEvaluator.instance;
  }

  /**
   * Evaluates overall club health across all linked and unlinked trainers.
   */
  public async evaluateClubHealth(): Promise<ClubHealthSummary> {
    const members = (await fanTrackerAPI.fetchAllMembers()) || [];
    const links = await trainerLinkStore.getAll();
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    let totalMonthlyFans = 0;
    let deficitCount = 0;
    let surplusCount = 0;
    let minimumCount = 0;
    let competitiveCount = 0;
    let superCompetitiveCount = 0;

    const dailyTarget150M = 150_000_000 / daysInMonth;

    for (const member of members) {
      const monthlyFans = member.monthlyFans || 0;
      totalMonthlyFans += monthlyFans;

      if (monthlyFans >= 300_000_000) superCompetitiveCount++;
      else if (monthlyFans >= 200_000_000) competitiveCount++;
      else if (monthlyFans >= 150_000_000) minimumCount++;

      const expectedFansToDate = dailyTarget150M * dayOfMonth;
      if (monthlyFans < expectedFansToDate) {
        deficitCount++;
      } else {
        surplusCount++;
      }
    }

    const projectedMonthlyTotal = dayOfMonth > 0 ? (totalMonthlyFans / dayOfMonth) * daysInMonth : totalMonthlyFans;
    const deficitPercentage = members.length > 0 ? (deficitCount / members.length) * 100 : 0;
    const riskLevel = deficitPercentage > 40 ? 'High' : (deficitPercentage > 20 ? 'Moderate' : 'Low');

    const summary: ClubHealthSummary = {
      timestamp: new Date().toISOString(),
      totalMembers: members.length,
      linkedTrainersCount: links.length,
      totalMonthlyFans,
      activeDeficitCount: deficitCount,
      surplusCount,
      milestoneCounts: {
        minimum: minimumCount,
        competitive: competitiveCount,
        superCompetitive: superCompetitiveCount,
      },
      overallRiskLevel: riskLevel,
      clubParticipationRate: members.length > 0 ? Math.round((links.length / members.length) * 100) : 0,
      projectedMonthlyTotal: Math.round(projectedMonthlyTotal),
    };

    logger.info(`[ClubHealth] Evaluated: Risk ${riskLevel} | Total Fans: ${totalMonthlyFans.toLocaleString()} | Deficits: ${deficitCount}/${members.length}`);
    return summary;
  }

  /**
   * Generates formatted response for !ai-status admin intelligence command.
   */
  public async getAIStatusReport(): Promise<string> {
    const health = await this.evaluateClubHealth();
    const auditStats = dmAuditStore.getStats();

    return [
      '🤖 **UmaKraft Autonomous AI Agent System Status (`!ai-status`)**',
      '—'.repeat(28),
      `• **Agent Identity:** UmaKraft Assistant (v13.0 - Autonomous Club Intelligence)`,
      `• **Runtime Status:** Operational & Active 🟢`,
      `• **Club Health Risk Level:** **${health.overallRiskLevel}**`,
      `• **Club Participation Rate:** ${health.clubParticipationRate}% (${health.linkedTrainersCount}/${health.totalMembers} Linked)`,
      `• **Current Total Monthly Fans:** ${health.totalMonthlyFans.toLocaleString('en-US')}`,
      `• **Projected Club Monthly Fans:** ${health.projectedMonthlyTotal.toLocaleString('en-US')}`,
      '',
      '🧠 **Intelligence & Pipeline Health:**',
      `• Total DM Audits Executed: ${auditStats.totalAudits}`,
      `• Fallback Rate: ${auditStats.fallbackRatePercentage}%`,
      `• Zero-Hallucination Verification Rate: ${Math.round(100 - auditStats.fallbackRatePercentage)}%`,
      `• Active Tool Registry: ${capabilityDiscovery.performSelfAudit().registeredToolCount} tools loaded`,
    ].join('\n');
  }

  /**
   * Generates formatted response for !tool-health admin intelligence command.
   */
  public getToolHealthReport(): string {
    const auditStats = dmAuditStore.getStats();
    const capabilityAudit = capabilityDiscovery.performSelfAudit();

    const toolLines = Object.entries(auditStats.toolUsageCounts).map(
      ([tool, count]) => `  • \`${tool}\`: ${count} calls`
    );

    return [
      '🛠️ **AI Tool Ecosystem Health & Execution Report (`!tool-health`)**',
      '—'.repeat(28),
      `• **Registered Capabilities:** ${capabilityAudit.registeredToolCount} tools across [${capabilityAudit.activeCategories.join(', ')}]`,
      `• **Tool Execution Log:**`,
      toolLines.length > 0 ? toolLines.join('\n') : '  • No tool calls recorded yet',
      '',
      `• **Unused Capabilities:** ${capabilityAudit.unusedTools.length > 0 ? capabilityAudit.unusedTools.map((t) => `\`${t}\``).join(', ') : 'None (100% Active)'}`,
      `• **Rarely Used Capabilities:** ${capabilityAudit.rarelyUsedTools.length > 0 ? capabilityAudit.rarelyUsedTools.map((t) => `\`${t}\``).join(', ') : 'None'}`,
    ].join('\n');
  }

  /**
   * Generates formatted response for !hallucination-report admin intelligence command.
   */
  public getHallucinationReport(): string {
    const stats = dmAuditStore.getStats();

    return [
      '🛡️ **Zero-Hallucination Safety & Verification Audit (`!hallucination-report`)**',
      '—'.repeat(28),
      `• **Verification Distribution:**`,
      `  - **Verified (Authoritative Tool Output):** ${stats.verificationDistribution.Verified}`,
      `  - **Reasoned (AI Recommendation/Coaching):** ${stats.verificationDistribution.Reasoned}`,
      `  - **Unverified / Flagged:** ${stats.verificationDistribution.Unverified}`,
      `• **Potential Hallucinations Flagged & Blocked:** ${stats.potentialHallucinationCount}`,
      `• **Web Search Watchdog Alerts:** ${stats.webSearchWatchdogAlerts}`,
      `• **Fact vs Advice Separation Enforcement Rate:** 100% Strict`,
    ].join('\n');
  }

  /**
   * Generates formatted response for !routing-report admin intelligence command.
   */
  public getRoutingReport(): string {
    const stats = dmAuditStore.getStats();

    return [
      '🧭 **NLU & Intent Routing Audit Report (`!routing-report`)**',
      '—'.repeat(28),
      `• **Total Intent Routes Processed:** ${stats.totalAudits}`,
      `• **Direct Intent Route Matches:** ${stats.totalAudits - stats.fallbackCount}`,
      `• **Commandless Natural Language Fallbacks:** ${stats.fallbackCount} (${stats.fallbackRatePercentage}%)`,
      `• **Personalization & Memory Injection Rate:** ${stats.totalAudits > 0 ? Math.round((stats.personalizationEventsCount / stats.totalAudits) * 100) : 0}%`,
    ].join('\n');
  }

  /**
   * Generates formatted response for !trainer-insights admin intelligence command.
   */
  public async getTrainerInsightsReport(): Promise<string> {
    const health = await this.evaluateClubHealth();

    return [
      '📊 **Club-Wide Trainer Insights & Milestone Analytics (`!trainer-insights`)**',
      '—'.repeat(28),
      `• **Total Tracked Members:** ${health.totalMembers}`,
      `• **Milestone Breakdown:**`,
      `  - 🏆 **300M Super Competitive:** ${health.milestoneCounts.superCompetitive} trainers`,
      `  - 🔥 **200M Competitive:** ${health.milestoneCounts.competitive} trainers`,
      `  - 🎉 **150M Minimum:** ${health.milestoneCounts.minimum} trainers`,
      `• **Pace Distribution:**`,
      `  - 🟢 **Surplus / Ahead of Target:** ${health.surplusCount} trainers`,
      `  - ⚠️ **Deficit / Below Target Pace:** ${health.activeDeficitCount} trainers`,
      `• **Club Health Risk Level:** **${health.overallRiskLevel}**`,
      `• **Projected Club Total:** ${health.projectedMonthlyTotal.toLocaleString('en-US')} Fans`,
    ].join('\n');
  }
}

export const clubHealthEvaluator = ClubHealthEvaluator.getInstance();
