import { ILeaderboardRepository } from '../repositories/leaderboard-repository.js';
import { LeaderboardEntryEntity } from '../repositories/repository-types.js';
import { DatabaseKnowledgeResult } from '../database-result.js';

export interface NearbyCompetitorsResult {
  current: LeaderboardEntryEntity;
  above?: LeaderboardEntryEntity;
  below?: LeaderboardEntryEntity;
  distanceToAbove?: number;
  distanceToBelow?: number;
}

export class LeaderboardKnowledgeModule {
  private leaderboardRepository: ILeaderboardRepository;

  constructor(leaderboardRepository: ILeaderboardRepository) {
    this.leaderboardRepository = leaderboardRepository;
  }

  public async getLeaderboard(limit: number = 10, offset: number = 0): Promise<LeaderboardEntryEntity[]> {
    return this.leaderboardRepository.getEntries(limit, offset);
  }

  public async getTrainerRank(trainerIdOrName: string): Promise<LeaderboardEntryEntity | null> {
    let entry = await this.leaderboardRepository.getRankByTrainerId(trainerIdOrName);
    if (!entry) {
      entry = await this.leaderboardRepository.getRankByName(trainerIdOrName);
    }
    return entry;
  }

  public async getNearbyCompetitors(trainerIdOrName: string, range: number = 1): Promise<NearbyCompetitorsResult | null> {
    const all = await this.leaderboardRepository.getEntries(100, 0);
    const index = all.findIndex(
      e => e.trainerId === trainerIdOrName ||
           e.trainerName.toLowerCase() === trainerIdOrName.toLowerCase() ||
           e.linkedDiscordId === trainerIdOrName
    );

    if (index === -1) return null;

    const current = all[index];
    const above = index > 0 ? all[index - 1] : undefined;
    const below = index < all.length - 1 ? all[index + 1] : undefined;

    return {
      current,
      above,
      below,
      distanceToAbove: above ? Math.max(0, above.fans - current.fans) : undefined,
      distanceToBelow: below ? Math.max(0, current.fans - below.fans) : undefined
    };
  }

  public async getClubRanking(): Promise<{ clubName: string; rank: number; totalFans: number; memberCount: number }> {
    const all = await this.leaderboardRepository.getEntries(100, 0);
    const totalFans = all.reduce((sum, e) => sum + e.fans, 0);
    return {
      clubName: 'Umakraft',
      rank: 1,
      totalFans,
      memberCount: all.length
    };
  }

  public toLeaderboardKnowledgeResult(entries: LeaderboardEntryEntity[]): DatabaseKnowledgeResult {
    return {
      source: 'database',
      entityType: 'leaderboard',
      entityId: 'umakraft_leaderboard',
      payload: {
        totalEntries: entries.length,
        entries
      },
      confidence: 0.99,
      timestamp: new Date(),
      authority: 95,
      metadata: {
        domain: 'Leaderboards',
        topTrainer: entries[0]?.trainerName,
        topFans: entries[0]?.fans
      }
    };
  }

  public toRankKnowledgeResult(entry: LeaderboardEntryEntity, nearby?: NearbyCompetitorsResult | null): DatabaseKnowledgeResult {
    return {
      source: 'database',
      entityType: 'leaderboard',
      entityId: entry.trainerId,
      payload: {
        rank: entry.rank,
        trainerName: entry.trainerName,
        trainerId: entry.trainerId,
        fans: entry.fans,
        dailyGain: entry.dailyGain,
        monthlyGain: entry.monthlyGain,
        nearbyCompetitors: nearby
      },
      confidence: 0.99,
      timestamp: new Date(),
      authority: 95,
      metadata: {
        trainerId: entry.trainerId,
        trainerName: entry.trainerName,
        rank: entry.rank
      }
    };
  }
}
