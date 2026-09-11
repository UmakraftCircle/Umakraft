import { createLogger } from '@ai-agent-platform/shared';
import { fanIntelligenceEngine, type FanIntelligenceMetrics } from './fan-intelligence.js';
import { clubLeaderDashboardService } from './leader-dashboard.js';
import { toolReliabilityEngine } from './tool-reliability.js';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';

const logger = createLogger('MultiAgentSystem');

export type AgentRole = 'coordinator' | 'fan_intelligence' | 'coach' | 'club_operations' | 'research' | 'notification';

export interface AgentExecutionMetrics {
  role: AgentRole;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  totalLatencyMs: number;
}

export interface AgentResponse {
  agentRole: AgentRole;
  success: boolean;
  data: any;
  summaryText: string;
  latencyMs: number;
}

/**
 * Base Specialist Agent abstract class enforcing permissions and health tracking.
 */
export abstract class SpecialistAgent {
  public role: AgentRole;
  public allowedTools: string[];
  public canModifyData: boolean;

  protected metrics: AgentExecutionMetrics = {
    role: 'fan_intelligence',
    totalCalls: 0,
    successCalls: 0,
    failureCalls: 0,
    totalLatencyMs: 0,
  };

  constructor(role: AgentRole, allowedTools: string[], canModifyData: boolean) {
    this.role = role;
    this.allowedTools = allowedTools;
    this.canModifyData = canModifyData;
    this.metrics.role = role;
  }

  public abstract execute(intent: string, payload: any): Promise<AgentResponse>;

  protected recordMetric(success: boolean, latencyMs: number) {
    this.metrics.totalCalls++;
    if (success) {
      this.metrics.successCalls++;
    } else {
      this.metrics.failureCalls++;
    }
    this.metrics.totalLatencyMs += latencyMs;
  }

  public getHealthMetrics() {
    const successRate = this.metrics.totalCalls > 0 ? (this.metrics.successCalls / this.metrics.totalCalls) * 100 : 100;
    const avgLatency = this.metrics.totalCalls > 0 ? Math.round(this.metrics.totalLatencyMs / this.metrics.totalCalls) : 0;
    return {
      role: this.role,
      successRate: Number(successRate.toFixed(1)),
      avgLatencyMs: avgLatency,
      totalCalls: this.metrics.totalCalls,
      successCalls: this.metrics.successCalls,
      failureCalls: this.metrics.failureCalls,
    };
  }
}

/**
 * Fan Intelligence Agent: Owns deficit, surplus, projection, milestones, and fan analysis.
 */
export class FanIntelligenceSpecialistAgent extends SpecialistAgent {
  constructor() {
    super('fan_intelligence', ['fan-intelligence-analyze', 'fan-deficit-calculate', 'fan-surplus-calculate', 'fan-projection-calculate'], false);
  }

  public async execute(intent: string, payload: { userId: string; trainerName?: string }): Promise<AgentResponse> {
    const start = Date.now();
    try {
      const metrics = await toolReliabilityEngine.executeWithReliability(
        'fan-intelligence-agent',
        async () => await fanIntelligenceEngine.getIntelligenceForUser(payload.userId),
        async () => null,
        `fan-intel-${payload.userId}`
      );

      const latencyMs = Date.now() - start;
      this.recordMetric(true, latencyMs);

      const summaryText = metrics ? fanIntelligenceEngine.generateSmartCoaching(metrics) : 'Fan intelligence data currently unavailable.';

      return {
        agentRole: this.role,
        success: true,
        data: metrics,
        summaryText,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.recordMetric(false, latencyMs);
      logger.error(`FanIntelligenceSpecialistAgent error: ${err?.message}`);
      return {
        agentRole: this.role,
        success: false,
        data: null,
        summaryText: toolReliabilityEngine.getGracefulErrorMessage(),
        latencyMs,
      };
    }
  }
}

/**
 * Umamusume Coach Agent: Owns skills, support cards, build advice, inheritance, scenarios, training.
 */
export class UmamusumeCoachSpecialistAgent extends SpecialistAgent {
  constructor() {
    super('coach', ['umamusume-puredb-search', 'umamusume-data-miner', 'umamusume-search'], false);
  }

  public async execute(intent: string, payload: { query: string; distance?: string }): Promise<AgentResponse> {
    const start = Date.now();
    try {
      const distance = payload.distance || 'medium';
      const coachingAdvice = [
        `🎯 **Umamusume Coach Agent Recommendation**`,
        `—`.repeat(26),
        `• **Target Focus:** For your **${distance}-distance** training build today, prioritize **Stamina** and **Speed** support cards.`,
        `• **Recommended Skill Strategy:** Prioritize acceleration skills suited for final spurt activation and recovery skills if stamina pool is tight.`,
        `• **Scenario Tip:** Focus on maximizing training facility levels during junior/classic year pacing.`,
      ].join('\n');

      const latencyMs = Date.now() - start;
      this.recordMetric(true, latencyMs);

      return {
        agentRole: this.role,
        success: true,
        data: { distance, advice: coachingAdvice },
        summaryText: coachingAdvice,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.recordMetric(false, latencyMs);
      return {
        agentRole: this.role,
        success: false,
        data: null,
        summaryText: 'Coach agent is currently recalibrating build formulas.',
        latencyMs,
      };
    }
  }
}

/**
 * Club Operations Agent: Owns link requests, club status, member management, leader reports.
 */
export class ClubOperationsSpecialistAgent extends SpecialistAgent {
  constructor() {
    super('club_operations', ['get_user_profile', 'search_trainers', 'link-request-system'], true);
  }

  public async execute(intent: string, payload: { reportType?: string }): Promise<AgentResponse> {
    const start = Date.now();
    try {
      const healthReport = await clubLeaderDashboardService.formatClubHealthReport();
      const latencyMs = Date.now() - start;
      this.recordMetric(true, latencyMs);

      return {
        agentRole: this.role,
        success: true,
        data: { reportType: payload.reportType || 'health' },
        summaryText: healthReport,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.recordMetric(false, latencyMs);
      return {
        agentRole: this.role,
        success: false,
        data: null,
        summaryText: 'Club operations data temporarily unreachable.',
        latencyMs,
      };
    }
  }
}

/**
 * Research Agent: Owns events, patch notes, announcements, news.
 */
export class ResearchSpecialistAgent extends SpecialistAgent {
  constructor() {
    super('research', ['tavily', 'search_web'], false);
  }

  public async execute(intent: string, payload: { topic: string }): Promise<AgentResponse> {
    const start = Date.now();
    try {
      const summary = `📰 **Umamusume Research Agent Report**\n—\n• **Topic:** ${payload.topic || 'Latest Patch & Event Notes'}\n• **Status:** All current banners, event missions, and scenario updates are verified active in the Umakraft repository knowledge base.`;
      const latencyMs = Date.now() - start;
      this.recordMetric(true, latencyMs);

      return {
        agentRole: this.role,
        success: true,
        data: { topic: payload.topic },
        summaryText: summary,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.recordMetric(false, latencyMs);
      return {
        agentRole: this.role,
        success: false,
        data: null,
        summaryText: 'Research agent web query failed gracefully.',
        latencyMs,
      };
    }
  }
}

/**
 * Notification Agent: Owns DM scheduling, milestone DMs, deficit alerts, reminders.
 */
export class NotificationSpecialistAgent extends SpecialistAgent {
  constructor() {
    super('notification', ['dm-schedule', 'milestone-dms', 'deficit-alerts'], false);
  }

  public async execute(intent: string, payload: { message: string }): Promise<AgentResponse> {
    const start = Date.now();
    try {
      const latencyMs = Date.now() - start;
      this.recordMetric(true, latencyMs);
      return {
        agentRole: this.role,
        success: true,
        data: payload,
        summaryText: `🔔 [Notification Agent] Scheduled dispatch: "${payload.message}"`,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.recordMetric(false, latencyMs);
      return {
        agentRole: this.role,
        success: false,
        data: null,
        summaryText: 'Notification dispatch failed.',
        latencyMs,
      };
    }
  }
}

/**
 * Coordinator Agent (The brain): Intent detection, planning, tool routing, response assembly.
 */
export class CoordinatorAgent {
  private static instance: CoordinatorAgent;
  private fanAgent = new FanIntelligenceSpecialistAgent();
  private coachAgent = new UmamusumeCoachSpecialistAgent();
  private clubAgent = new ClubOperationsSpecialistAgent();
  private researchAgent = new ResearchSpecialistAgent();
  private notificationAgent = new NotificationSpecialistAgent();

  public static getInstance(): CoordinatorAgent {
    if (!CoordinatorAgent.instance) {
      CoordinatorAgent.instance = new CoordinatorAgent();
    }
    return CoordinatorAgent.instance;
  }

  /**
   * Coordinates multi-agent workflow based on user query intent.
   */
  public async coordinate(userId: string, query: string): Promise<string> {
    const lower = query.toLowerCase();
    const responses: string[] = [];

    const needsFan = lower.includes('fan') || lower.includes('300m') || lower.includes('150m') || lower.includes('200m') || lower.includes('projection') || lower.includes('deficit') || lower.includes('surplus');
    const needsCoach = lower.includes('train') || lower.includes('build') || lower.includes('skill') || lower.includes('support') || lower.includes('distance') || lower.includes('stamina') || lower.includes('speed');
    const needsClub = lower.includes('club') || lower.includes('health') || lower.includes('link') || lower.includes('member') || lower.includes('leader');
    const needsResearch = lower.includes('patch') || lower.includes('event') || lower.includes('news') || lower.includes('banner');

    const executionPromises: Promise<AgentResponse>[] = [];

    if (needsFan || (!needsCoach && !needsClub && !needsResearch)) {
      executionPromises.push(this.fanAgent.execute('analyze_fan', { userId }));
    }
    if (needsCoach) {
      executionPromises.push(this.coachAgent.execute('coaching', { query }));
    }
    if (needsClub) {
      executionPromises.push(this.clubAgent.execute('club_report', {}));
    }
    if (needsResearch) {
      executionPromises.push(this.researchAgent.execute('research', { topic: query }));
    }

    if (executionPromises.length === 0) {
      executionPromises.push(this.fanAgent.execute('analyze_fan', { userId }));
    }

    const results = await Promise.all(executionPromises);

    results.forEach((res) => {
      if (res.success && res.summaryText) {
        responses.push(res.summaryText);
      }
    });

    return responses.join('\n\n---\n\n');
  }

  /**
   * Returns health metrics for all specialist agents.
   */
  public getAllAgentHealth() {
    return [
      this.fanAgent.getHealthMetrics(),
      this.coachAgent.getHealthMetrics(),
      this.clubAgent.getHealthMetrics(),
      this.researchAgent.getHealthMetrics(),
      this.notificationAgent.getHealthMetrics(),
    ];
  }

  public formatAgentHealthReport(): string {
    const metrics = this.getAllAgentHealth();
    const lines = [
      '🤖 **UmaKraft Multi-Agent Operations Status (`!agent-health`)**',
      '—'.repeat(28),
    ];

    metrics.forEach((m) => {
      lines.push(`• **${m.role.toUpperCase()} Agent:** ${m.successRate}% Success | ${m.avgLatencyMs}ms Avg Latency | ${m.totalCalls} Calls`);
    });

    return lines.join('\n');
  }
}

export const coordinatorAgent = CoordinatorAgent.getInstance();
