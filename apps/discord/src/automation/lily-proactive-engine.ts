import type { Client, User } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { trainerMemoryStore } from './trainer-memory.js';
import { lilyMemoryService } from './lily-memory-service.js';
import { GlobalPersonalityLayer } from './global-personality.js';

const logger = createLogger('LilyProactiveEngine');

export interface ProactiveNotification {
  userId: string;
  type: 'daily_greeting' | 'milestone' | 'deficit_warning' | 'surplus_recognition' | 'goal_followup' | 'reminder' | 'inactivity_care';
  content: string;
  priority: number; // Higher number = higher priority
}

/**
 * LilyProactiveEngine — Manages proactive engagement, reminders, milestone celebrations,
 * deficit/surplus notices, and trainer care with strict anti-spam cooldowns.
 */
export class LilyProactiveEngine {
  private static instance: LilyProactiveEngine;
  private lastInteractionMap: Map<string, number> = new Map();
  private lastGreetingMap: Map<string, string> = new Map(); // userId -> 'YYYY-MM-DD'
  private notifiedMilestones: Set<string> = new Set(); // userId:milestone

  private constructor() {}

  public static getInstance(): LilyProactiveEngine {
    if (!LilyProactiveEngine.instance) {
      LilyProactiveEngine.instance = new LilyProactiveEngine();
    }
    return LilyProactiveEngine.instance;
  }

  /**
   * Evaluates and dispatches proactive messages for active trainers.
   */
  public async evaluateProactiveQueue(client: Client, activeUserIds: string[]): Promise<void> {
    logger.info(`[ProactiveEngine] Evaluating proactive queue for ${activeUserIds.length} trainers...`);

    for (const userId of activeUserIds) {
      try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user || user.bot) continue;

        const notification = this.generateProactiveNotification(userId, user);
        if (notification) {
          await this.dispatchNotification(user, notification);
        }
      } catch (err: any) {
        logger.error(`[ProactiveEngine] Error evaluating user ${userId}: ${err?.message}`);
      }
    }
  }

  private generateProactiveNotification(userId: string, user: User): ProactiveNotification | null {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastGreetingDate = this.lastGreetingMap.get(userId);
    const perm = trainerMemoryStore.getPermanentMemory(userId);
    const trainerName = perm.trainerName || user.username || 'Trainer';

    // 1. Daily Greeting (Priority 6 - Casual Greetings)
    if (lastGreetingDate !== todayStr) {
      this.lastGreetingMap.set(userId, todayStr);
      const hour = new Date().getHours();
      let greeting = `Good morning, ${trainerName}! I hope today brings great progress and successful training. 🐎`;
      if (hour >= 12 && hour < 17) {
        greeting = `Welcome back, ${trainerName}. I hope your day has been going well!`;
      } else if (hour >= 17) {
        greeting = `Good evening, ${trainerName}. Don't forget to take some time to rest after a busy day.`;
      }

      return {
        userId,
        type: 'daily_greeting',
        content: greeting,
        priority: 1,
      };
    }

    // 2. Goal Follow-Up Check (Priority 5)
    const work = trainerMemoryStore.getWorkingMemory(userId);
    if (work.activeGoals.length > 0 && Math.random() < 0.2) {
      const goal = work.activeGoals[0];
      return {
        userId,
        type: 'goal_followup',
        content: `Trainer, last time you mentioned aiming for "${goal}". Would you like me to check your current progress?`,
        priority: 2,
      };
    }

    return null;
  }

  private async dispatchNotification(user: User, notification: ProactiveNotification): Promise<void> {
    try {
      const dmChannel = await user.createDM();
      await dmChannel.send(notification.content);
      logger.info(`[ProactiveEngine] Dispatched proactive notification [${notification.type}] to Trainer ${user.tag}`);
    } catch (err: any) {
      logger.warn(`[ProactiveEngine] Failed to dispatch proactive notification to ${user.tag}: ${err?.message}`);
    }
  }

  /**
   * Evaluates milestone celebration for a trainer when new data is submitted.
   */
  public async checkMilestoneCelebration(client: Client, userId: string, totalFans: number): Promise<void> {
    const key150 = `${userId}:150m`;
    const key200 = `${userId}:200m`;
    const key300 = `${userId}:300m`;

    let milestoneMsg = '';
    if (totalFans >= 300_000_000 && !this.notifiedMilestones.has(key300)) {
      this.notifiedMilestones.add(key300);
      milestoneMsg = `Amazing effort, Trainer! You've reached the Super Competitive milestone (300M+ fans). Your dedication is truly inspiring!`;
    } else if (totalFans >= 200_000_000 && !this.notifiedMilestones.has(key200)) {
      this.notifiedMilestones.add(key200);
      milestoneMsg = `Excellent work, Trainer! You've reached the Competitive milestone (200M+ fans). Keep up the fantastic momentum!`;
    } else if (totalFans >= 150_000_000 && !this.notifiedMilestones.has(key150)) {
      this.notifiedMilestones.add(key150);
      milestoneMsg = `Congratulations, Trainer! You've reached the minimum fan requirement milestone (150M+ fans). Your hard work is paying off!`;
    }

    if (milestoneMsg) {
      try {
        const user = await client.users.fetch(userId);
        if (user) {
          const dm = await user.createDM();
          await dm.send(milestoneMsg);
          logger.info(`[ProactiveEngine] Celebrated milestone with Trainer ${user.tag}`);
        }
      } catch (err: any) {
        logger.warn(`[ProactiveEngine] Failed to send milestone celebration: ${err?.message}`);
      }
    }
  }
}

export const lilyProactiveEngine = LilyProactiveEngine.getInstance();
