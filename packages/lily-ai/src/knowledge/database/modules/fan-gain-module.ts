import { IFanRepository } from '../repositories/fan-repository.js';
import { FanStatsEntity } from '../repositories/repository-types.js';
import { DatabaseKnowledgeResult } from '../database-result.js';

export interface FanGainQueryResult {
  currentFans: number;
  dailyGain: number;
  monthlyGain: number;
  targetFans: number;
  remainingFans: number;
  deficit: number;
  surplus: number;
  requiredDailyGain: number;
  projectedMonthEnd: number;
  currentMilestone: string;
  nextMilestone?: string;
}

export class FanGainKnowledgeModule {
  private fanRepository: IFanRepository;

  constructor(fanRepository: IFanRepository) {
    this.fanRepository = fanRepository;
  }

  public async getFanStatistics(trainerIdOrName: string): Promise<FanStatsEntity | null> {
    let stats = await this.fanRepository.getStatsByTrainerId(trainerIdOrName);
    if (!stats) {
      stats = await this.fanRepository.getStatsByTrainerName(trainerIdOrName);
    }
    return stats;
  }

  public async getFanGain(trainerId: string): Promise<number> {
    const stats = await this.getFanStatistics(trainerId);
    return stats?.dailyGain ?? 0;
  }

  public async getMonthlyFanGain(trainerId: string): Promise<number> {
    const stats = await this.getFanStatistics(trainerId);
    return stats?.monthlyGain ?? 0;
  }

  public async getDailyFanGain(trainerId: string): Promise<number> {
    const stats = await this.getFanStatistics(trainerId);
    return stats?.dailyGain ?? 0;
  }

  public async getRemainingFans(trainerId: string, targetMilestone: number = 150_000_000): Promise<number> {
    const stats = await this.getFanStatistics(trainerId);
    if (!stats) return targetMilestone;
    return Math.max(0, targetMilestone - stats.totalFans);
  }

  public async getFanDeficit(trainerId: string): Promise<number> {
    const stats = await this.getFanStatistics(trainerId);
    return stats?.deficit ?? 0;
  }

  public async getFanSurplus(trainerId: string): Promise<number> {
    const stats = await this.getFanStatistics(trainerId);
    return stats?.surplus ?? 0;
  }

  public async toKnowledgeResult(stats: FanStatsEntity): Promise<DatabaseKnowledgeResult> {
    const payload: FanGainQueryResult = {
      currentFans: stats.totalFans,
      dailyGain: stats.dailyGain,
      monthlyGain: stats.monthlyGain,
      targetFans: stats.nextMilestone ? stats.totalFans + (stats.remainingFansToNextMilestone || 0) : 150_000_000,
      remainingFans: stats.remainingFansToNextMilestone ?? 0,
      deficit: stats.deficit ?? 0,
      surplus: stats.surplus ?? 0,
      requiredDailyGain: stats.requiredDailyGain ?? 0,
      projectedMonthEnd: stats.projectedMonthEnd ?? stats.totalFans,
      currentMilestone: stats.currentMilestone,
      nextMilestone: stats.nextMilestone
    };

    return {
      source: 'database',
      entityType: 'fan_gain',
      entityId: stats.trainerId,
      payload,
      confidence: 0.98,
      timestamp: new Date(),
      authority: 95,
      metadata: {
        trainerId: stats.trainerId,
        trainerName: stats.trainerName,
        currentMilestone: stats.currentMilestone,
        nextMilestone: stats.nextMilestone
      }
    };
  }
}
