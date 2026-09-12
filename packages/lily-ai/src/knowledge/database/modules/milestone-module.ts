import { IMilestoneRepository } from '../repositories/milestone-repository.js';
import { IFanRepository } from '../repositories/fan-repository.js';
import { MilestoneDefinitionEntity } from '../repositories/repository-types.js';
import { DatabaseKnowledgeResult } from '../database-result.js';

export interface MilestoneProgressResult {
  currentFans: number;
  currentMilestone: MilestoneDefinitionEntity | null;
  nextMilestone: MilestoneDefinitionEntity | null;
  remainingFans: number;
  progressPercentage: number;
  isEligible150M: boolean;
  isEligible200M: boolean;
  isEligible300M: boolean;
}

export class MilestoneKnowledgeModule {
  private milestoneRepository: IMilestoneRepository;
  private fanRepository: IFanRepository;

  constructor(milestoneRepository: IMilestoneRepository, fanRepository: IFanRepository) {
    this.milestoneRepository = milestoneRepository;
    this.fanRepository = fanRepository;
  }

  public async getMilestones(): Promise<MilestoneDefinitionEntity[]> {
    return this.milestoneRepository.getAll();
  }

  public async checkEligibility(
    trainerIdOrFans: string | number,
    targetMilestone: string | number = 150_000_000
  ): Promise<{ eligible: boolean; currentFans: number; requiredFans: number; deficit: number }> {
    let fans = 0;
    if (typeof trainerIdOrFans === 'number') {
      fans = trainerIdOrFans;
    } else {
      const stats = await this.fanRepository.getStatsByTrainerId(trainerIdOrFans) ||
                    await this.fanRepository.getStatsByTrainerName(trainerIdOrFans);
      fans = stats?.totalFans ?? 0;
    }

    let requiredFans = 150_000_000;
    if (typeof targetMilestone === 'number') {
      requiredFans = targetMilestone;
    } else {
      const def = await this.milestoneRepository.findByTitle(targetMilestone);
      if (def) requiredFans = def.requiredFans;
    }

    const eligible = fans >= requiredFans;
    const deficit = eligible ? 0 : requiredFans - fans;

    return {
      eligible,
      currentFans: fans,
      requiredFans,
      deficit
    };
  }

  public async getProgress(trainerIdOrFans: string | number): Promise<MilestoneProgressResult> {
    let fans = 0;
    if (typeof trainerIdOrFans === 'number') {
      fans = trainerIdOrFans;
    } else {
      const stats = await this.fanRepository.getStatsByTrainerId(trainerIdOrFans) ||
                    await this.fanRepository.getStatsByTrainerName(trainerIdOrFans);
      fans = stats?.totalFans ?? 0;
    }

    const currentMilestone = await this.milestoneRepository.findByFans(fans);
    const nextMilestone = await this.milestoneRepository.getNextMilestone(fans);

    let remainingFans = 0;
    let progressPercentage = 100;

    if (nextMilestone) {
      remainingFans = Math.max(0, nextMilestone.requiredFans - fans);
      const prevFans = currentMilestone ? currentMilestone.requiredFans : 0;
      const tierRange = nextMilestone.requiredFans - prevFans;
      const fansInTier = fans - prevFans;
      progressPercentage = Math.min(100, Math.max(0, Math.round((fansInTier / tierRange) * 100)));
    }

    return {
      currentFans: fans,
      currentMilestone,
      nextMilestone,
      remainingFans,
      progressPercentage,
      isEligible150M: fans >= 150_000_000,
      isEligible200M: fans >= 200_000_000,
      isEligible300M: fans >= 300_000_000
    };
  }

  public toKnowledgeResult(progress: MilestoneProgressResult, trainerId?: string): DatabaseKnowledgeResult {
    return {
      source: 'database',
      entityType: 'milestone',
      entityId: trainerId || 'milestone_progress',
      payload: progress,
      confidence: 0.99,
      timestamp: new Date(),
      authority: 95,
      metadata: {
        currentMilestone: progress.currentMilestone?.title || 'None',
        nextMilestone: progress.nextMilestone?.title,
        remainingFans: progress.remainingFans
      }
    };
  }
}
