import { createLogger } from '@ai-agent-platform/shared';
import { fanPaceService, type FanPaceReport } from './fan-pace.js';
import { trainerMemoryStore } from './trainer-memory.js';

const logger = createLogger('ProactiveEngine');

export type TriggerType =
  | 'deficit_warning'
  | 'milestone_achievement'
  | 'goal_projection'
  | 'project_followup'
  | 'surplus_congratulations';

export interface ProactiveTriggerCandidate {
  userId: string;
  triggerType: TriggerType;
  priority: 1 | 2 | 3 | 4 | 5;
  message: string;
  metadata?: Record<string, any>;
}

export interface ProactiveAuditRecord {
  timestamp: string;
  userId: string;
  triggerType: TriggerType;
  priority: number;
  messageSent: string;
  cooldownHours: number;
}

export class ProactiveEngine {
  private static instance: ProactiveEngine;

  // Stores timestamp of last notification per user per trigger type
  private lastNotifiedTimestamps: Map<string, Map<TriggerType, number>> = new Map();

  // Audit history of sent proactive notifications
  private auditHistory: ProactiveAuditRecord[] = [];

  // Cooldown durations in milliseconds
  private readonly cooldowns: Record<TriggerType, number> = {
    deficit_warning: 24 * 3600 * 1000, // 24 hours
    milestone_achievement: 30 * 24 * 3600 * 1000, // 30 days (once per month)
    goal_projection: 24 * 3600 * 1000, // 24 hours
    project_followup: 48 * 3600 * 1000, // 48 hours
    surplus_congratulations: 48 * 3600 * 1000, // 48 hours
  };

  public static getInstance(): ProactiveEngine {
    if (!ProactiveEngine.instance) {
      ProactiveEngine.instance = new ProactiveEngine();
    }
    return ProactiveEngine.instance;
  }

  /**
   * Checks if a trigger type is on cooldown for a given user.
   */
  public isCoolingDown(userId: string, triggerType: TriggerType): boolean {
    const userMap = this.lastNotifiedTimestamps.get(userId);
    if (!userMap) return false;

    const lastTime = userMap.get(triggerType);
    if (!lastTime) return false;

    const cooldownDuration = this.cooldowns[triggerType];
    return Date.now() - lastTime < cooldownDuration;
  }

  /**
   * Records a notification timestamp to enforce anti-spam cooldowns.
   */
  public recordNotification(userId: string, triggerType: TriggerType, priority: number, message: string): void {
    if (!this.lastNotifiedTimestamps.has(userId)) {
      this.lastNotifiedTimestamps.set(userId, new Map());
    }

    this.lastNotifiedTimestamps.get(userId)!.set(triggerType, Date.now());

    const record: ProactiveAuditRecord = {
      timestamp: new Date().toISOString(),
      userId,
      triggerType,
      priority,
      messageSent: message,
      cooldownHours: this.cooldowns[triggerType] / (3600 * 1000),
    };

    this.auditHistory.push(record);

    logger.info(
      `[telemetry] Proactive Trigger Sent | User: ${userId} | TriggerType: ${triggerType} | Priority: ${priority} | Cooldown: ${record.cooldownHours}h`,
    );
  }

  /**
   * Evaluates a trainer's live context and active status to find proactive notification candidates.
   */
  public async evaluateTrainer(userId: string): Promise<ProactiveTriggerCandidate | null> {
    const paceReport = await fanPaceService.getPaceForUser(userId);
    if (!paceReport) return null;

    const permMem = trainerMemoryStore.getPermanentMemory(userId);
    const workMem = trainerMemoryStore.getWorkingMemory(userId);
    const name = permMem.trainerName || 'Trainer';

    const candidates: ProactiveTriggerCandidate[] = [];

    // Priority 1: Deficit Warning
    if (paceReport.deficit > 0 && !this.isCoolingDown(userId, 'deficit_warning')) {
      const deficitM = (paceReport.deficit / 1_000_000).toFixed(1);
      candidates.push({
        userId,
        triggerType: 'deficit_warning',
        priority: 1,
        message: [
          `⚠️ **Proactive Fan Deficit Alert**`,
          `Hello ${name}! You are currently **${deficitM}M fans** behind expected pace for the monthly club target.`,
          `Would you like me to generate an optimized recovery plan to help you catch up? 🐎`,
        ].join('\n'),
      });
    }

    // Priority 2: Milestone Achievement (Check 150M, 200M, 300M)
    const currentM = paceReport.currentFans / 1_000_000;
    if (currentM >= 150 && !this.isCoolingDown(userId, 'milestone_achievement')) {
      let tier = '150M';
      if (currentM >= 300) tier = '300M (Super Competitive)';
      else if (currentM >= 200) tier = '200M (Competitive)';

      candidates.push({
        userId,
        triggerType: 'milestone_achievement',
        priority: 2,
        message: [
          `🎉 **Congratulations ${name}!**`,
          `You have officially achieved the **${tier} Fan Milestone**!`,
          `Your contribution is driving the club forward. Excellent work! 🏆`,
        ].join('\n'),
      });
    }

    // Priority 3: Milestone Goal Projection (Close to target)
    if (paceReport.remainingToTarget > 0 && paceReport.remainingToTarget <= 10_000_000 && !this.isCoolingDown(userId, 'goal_projection')) {
      const remainingM = (paceReport.remainingToTarget / 1_000_000).toFixed(1);
      candidates.push({
        userId,
        triggerType: 'goal_projection',
        priority: 3,
        message: [
          `🎯 **Milestone Target In Sight!**`,
          `${name}, you are only **${remainingM}M fans** away from reaching your monthly milestone target!`,
          `A strong training session today could push you right over the goal line. You've got this! 🐎`,
        ].join('\n'),
      });
    }

    // Priority 4: Ongoing Project Follow-Up
    if (workMem.currentBuild && !this.isCoolingDown(userId, 'project_followup')) {
      candidates.push({
        userId,
        triggerType: 'project_followup',
        priority: 4,
        message: [
          `💡 **Training Project Follow-Up**`,
          `Welcome back, ${name}! Last time we discussed your **${workMem.currentBuild}** build project.`,
          `Would you like me to review your latest stat distribution or skill priority list?`,
        ].join('\n'),
      });
    }

    // Priority 5: Surplus Congratulations
    if (paceReport.surplus > 0 && !this.isCoolingDown(userId, 'surplus_congratulations')) {
      const surplusM = (paceReport.surplus / 1_000_000).toFixed(1);
      candidates.push({
        userId,
        triggerType: 'surplus_congratulations',
        priority: 5,
        message: [
          `🌟 **Pace Surplus Update**`,
          `Great news ${name}! You are currently **+${surplusM}M fans ahead of expected pace**.`,
          `At your current rate, you are projected to easily exceed month-end targets!`,
        ].join('\n'),
      });
    }

    if (candidates.length === 0) return null;

    // Pick highest priority candidate (lowest priority number)
    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0];
  }

  /**
   * Returns proactive telemetry audit history.
   */
  public getAuditHistory(): ProactiveAuditRecord[] {
    return [...this.auditHistory];
  }
}

export const proactiveEngine = ProactiveEngine.getInstance();
