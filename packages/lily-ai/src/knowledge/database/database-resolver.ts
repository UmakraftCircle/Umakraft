import { DatabaseRegistry } from './database-registry.js';
import { DatabaseKnowledgeResult, UserSecurityContext } from './database-result.js';
import { DatabaseQueryEngine } from './database-query-engine.js';

export interface ResolvedDatabaseIntent {
  intent: string;
  entityType?: string;
  entityId?: string;
  targetTrainerId?: string;
  targetTrainerName?: string;
  targetMilestone?: string | number;
  isComposite?: boolean;
  limit?: number;
}

export class DatabaseResolver {
  private registry: DatabaseRegistry;
  private queryEngine: DatabaseQueryEngine;

  constructor(registry: DatabaseRegistry, queryEngine: DatabaseQueryEngine) {
    this.registry = registry;
    this.queryEngine = queryEngine;
  }

  public async resolveIntent(input: string, userContext?: UserSecurityContext): Promise<ResolvedDatabaseIntent> {
    const text = input.trim().toLowerCase();

    // 1. Natural language composite query: "How am I doing this month?" / "how am i doing" / "my progress"
    if (
      text.includes('how am i doing') ||
      text.includes('my status') ||
      text.includes('my performance') ||
      text.includes('monthly summary') ||
      text.includes('how am i performing')
    ) {
      const targetId = userContext?.trainerId || userContext?.discordUserId || '123456';
      return {
        intent: 'composite_status',
        entityType: 'composite_status',
        targetTrainerId: targetId,
        isComposite: true
      };
    }

    // 2. Intent: Fan Gain / Fans / Deficit / Surplus
    if (
      text.includes('fan gain') ||
      text.includes('daily fan') ||
      text.includes('monthly fan') ||
      text.includes('how many fans') ||
      text.includes('fan count') ||
      text.includes('my fans') ||
      text.includes('fan deficit') ||
      text.includes('fan surplus') ||
      text.includes('fans')
    ) {
      let targetId = userContext?.trainerId || userContext?.discordUserId;
      let targetName: string | undefined;

      // Check if another trainer name is mentioned
      const members = await this.registry.leaderboardRepo.getEntries(100, 0);
      for (const m of members) {
        if (text.includes(m.trainerName.toLowerCase())) {
          targetId = m.trainerId;
          targetName = m.trainerName;
          break;
        }
      }

      return {
        intent: 'fan_gain',
        entityType: 'fan_gain',
        targetTrainerId: targetId,
        targetTrainerName: targetName
      };
    }

    // 3. Intent: Leaderboard / Ranking / Top Trainers / Standings
    if (
      text.includes('leaderboard') ||
      text.includes('ranking') ||
      text.includes('standings') ||
      text.includes('top trainers') ||
      text.includes('top 10') ||
      text.includes('top 5') ||
      text.includes('top 20') ||
      text.includes('rank')
    ) {
      // Check if user is asking "What is my rank?" vs "Show leaderboard"
      if (text.includes('my rank') || text.includes("what's my rank") || text.includes('where am i')) {
        const targetId = userContext?.trainerId || userContext?.discordUserId || '123456';
        return {
          intent: 'member_rank',
          entityType: 'leaderboard',
          targetTrainerId: targetId
        };
      }

      let limit = 10;
      const match = text.match(/top\s+(\d+)/);
      if (match) {
        limit = parseInt(match[1], 10);
      }

      return {
        intent: 'leaderboard',
        entityType: 'leaderboard',
        limit
      };
    }

    // 4. Intent: Milestone / Eligibility (e.g. "Am I eligible for 200M?", "milestone progress")
    if (
      text.includes('milestone') ||
      text.includes('eligible') ||
      text.includes('eligibility') ||
      text.includes('150m') ||
      text.includes('200m') ||
      text.includes('300m') ||
      text.includes('target fans') ||
      text.includes('minimum fans')
    ) {
      const targetId = userContext?.trainerId || userContext?.discordUserId || '123456';
      let targetMilestone: string | number = 150_000_000;
      if (text.includes('200m') || text.includes('competitive')) targetMilestone = 200_000_000;
      if (text.includes('300m') || text.includes('super competitive')) targetMilestone = 300_000_000;

      return {
        intent: 'milestone',
        entityType: 'milestone',
        targetTrainerId: targetId,
        targetMilestone
      };
    }

    // 5. Intent: Club stats / overview
    if (
      text.includes('club') ||
      text.includes('umakraft') ||
      text.includes('club stats') ||
      text.includes('club health')
    ) {
      return {
        intent: 'club_stats',
        entityType: 'club',
        entityId: '974470619'
      };
    }

    // 6. Intent: Link Request / Account Linking
    if (
      text.includes('link request') ||
      text.includes('link status') ||
      text.includes('link my account') ||
      text.includes('am i linked') ||
      text.includes('linking')
    ) {
      const targetId = userContext?.discordUserId || userContext?.trainerId;
      return {
        intent: 'link_request',
        entityType: 'link_request',
        targetTrainerId: targetId
      };
    }

    // 7. Fallback: Trainer search or default query
    let targetId: string | undefined;
    const members = await this.registry.leaderboardRepo.getEntries(100, 0);
    for (const m of members) {
      if (text.includes(m.trainerName.toLowerCase())) {
        targetId = m.trainerId;
        break;
      }
    }

    return {
      intent: 'general_lookup',
      entityType: targetId ? 'trainer' : undefined,
      entityId: targetId,
      term: input
    } as ResolvedDatabaseIntent & { term: string };
  }

  public async resolve(input: string, userContext?: UserSecurityContext): Promise<DatabaseKnowledgeResult[]> {
    const resolvedIntent = await this.resolveIntent(input, userContext);

    // Handle composite status
    if (resolvedIntent.intent === 'composite_status' && resolvedIntent.targetTrainerId) {
      const trainerId = resolvedIntent.targetTrainerId;
      const [stats, rankEntry, progress] = await Promise.all([
        this.registry.fanModule.getFanStatistics(trainerId),
        this.registry.leaderboardModule.getTrainerRank(trainerId),
        this.registry.milestoneModule.getProgress(trainerId)
      ]);

      const nearby = rankEntry ? await this.registry.leaderboardModule.getNearbyCompetitors(trainerId) : null;

      const compositePayload = {
        trainerId,
        trainerName: stats?.trainerName || rankEntry?.trainerName || 'Trainer',
        fanStatistics: stats,
        rank: rankEntry?.rank,
        leaderboard: rankEntry,
        nearbyCompetitors: nearby,
        milestoneProgress: progress
      };

      return [{
        source: 'database',
        entityType: 'composite_status',
        entityId: trainerId,
        payload: compositePayload,
        confidence: 0.99,
        timestamp: new Date(),
        authority: 95,
        metadata: {
          trainerId,
          trainerName: compositePayload.trainerName,
          rank: rankEntry?.rank,
          totalFans: stats?.totalFans
        }
      }];
    }

    // Handle member rank intent
    if (resolvedIntent.intent === 'member_rank' && resolvedIntent.targetTrainerId) {
      const rankEntry = await this.registry.leaderboardModule.getTrainerRank(resolvedIntent.targetTrainerId);
      if (rankEntry) {
        const nearby = await this.registry.leaderboardModule.getNearbyCompetitors(rankEntry.trainerId);
        return [this.registry.leaderboardModule.toRankKnowledgeResult(rankEntry, nearby)];
      }
    }

    // Handle fan gain intent
    if (resolvedIntent.intent === 'fan_gain' && (resolvedIntent.targetTrainerId || resolvedIntent.targetTrainerName)) {
      const term = resolvedIntent.targetTrainerId || resolvedIntent.targetTrainerName!;
      const stats = await this.registry.fanModule.getFanStatistics(term);
      if (stats) {
        return [await this.registry.fanModule.toKnowledgeResult(stats)];
      }
    }

    // Handle milestone intent
    if (resolvedIntent.intent === 'milestone') {
      const trainerId = resolvedIntent.targetTrainerId || '123456';
      const progress = await this.registry.milestoneModule.getProgress(trainerId);
      return [this.registry.milestoneModule.toKnowledgeResult(progress, trainerId)];
    }

    // Standard execution through query engine
    return this.queryEngine.execute({
      entityType: resolvedIntent.entityType,
      entityId: resolvedIntent.entityId || resolvedIntent.targetTrainerId,
      term: input,
      limit: resolvedIntent.limit,
      userContext
    });
  }
}
