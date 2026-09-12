import { MilestoneDefinitionEntity } from './repository-types.js';

export interface IMilestoneRepository {
  getAll(): Promise<MilestoneDefinitionEntity[]>;
  findById(id: string): Promise<MilestoneDefinitionEntity | null>;
  findByTitle(title: string): Promise<MilestoneDefinitionEntity | null>;
  findByFans(fans: number): Promise<MilestoneDefinitionEntity | null>;
  getNextMilestone(fans: number): Promise<MilestoneDefinitionEntity | null>;
}

export class DefaultMilestoneRepository implements IMilestoneRepository {
  private milestones: MilestoneDefinitionEntity[] = [
    {
      id: 'milestone_150m',
      title: 'Minimum',
      requiredFans: 150_000_000,
      description: 'Official Umakraft monthly minimum requirement for maintaining active club membership.',
      tier: 1
    },
    {
      id: 'milestone_200m',
      title: 'Competitive',
      requiredFans: 200_000_000,
      description: 'Competitive trainer threshold for top-tier club rank security and seasonal performance.',
      tier: 2
    },
    {
      id: 'milestone_300m',
      title: 'Super Competitive',
      requiredFans: 300_000_000,
      description: 'Super competitive elite tier for high-ranking leaderboards and national club honors.',
      tier: 3
    }
  ];

  public async getAll(): Promise<MilestoneDefinitionEntity[]> {
    return [...this.milestones];
  }

  public async findById(id: string): Promise<MilestoneDefinitionEntity | null> {
    const found = this.milestones.find(m => m.id === id);
    return found || null;
  }

  public async findByTitle(title: string): Promise<MilestoneDefinitionEntity | null> {
    const lower = title.trim().toLowerCase();
    const found = this.milestones.find(m => m.title.toLowerCase() === lower || m.id.toLowerCase() === lower);
    return found || null;
  }

  public async findByFans(fans: number): Promise<MilestoneDefinitionEntity | null> {
    const sorted = [...this.milestones].sort((a, b) => b.requiredFans - a.requiredFans);
    for (const m of sorted) {
      if (fans >= m.requiredFans) {
        return m;
      }
    }
    return null;
  }

  public async getNextMilestone(fans: number): Promise<MilestoneDefinitionEntity | null> {
    const sorted = [...this.milestones].sort((a, b) => a.requiredFans - b.requiredFans);
    for (const m of sorted) {
      if (fans < m.requiredFans) {
        return m;
      }
    }
    return null;
  }
}
