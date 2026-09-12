import { ITrainerRepository, DefaultTrainerRepository } from './repositories/trainer-repository.js';
import { ILeaderboardRepository, DefaultLeaderboardRepository } from './repositories/leaderboard-repository.js';
import { IFanRepository, DefaultFanRepository } from './repositories/fan-repository.js';
import { IClubRepository, DefaultClubRepository } from './repositories/club-repository.js';
import { ILinkRepository, DefaultLinkRepository } from './repositories/link-repository.js';
import { IMilestoneRepository, DefaultMilestoneRepository } from './repositories/milestone-repository.js';

import { FanGainKnowledgeModule } from './modules/fan-gain-module.js';
import { LeaderboardKnowledgeModule } from './modules/leaderboard-module.js';
import { LinkRequestKnowledgeModule } from './modules/link-request-module.js';
import { MilestoneKnowledgeModule } from './modules/milestone-module.js';
import { ClubKnowledgeModule } from './modules/club-module.js';

export interface DatabaseRegistryOptions {
  trainerRepo?: ITrainerRepository;
  leaderboardRepo?: ILeaderboardRepository;
  fanRepo?: IFanRepository;
  clubRepo?: IClubRepository;
  linkRepo?: ILinkRepository;
  milestoneRepo?: IMilestoneRepository;
}

export class DatabaseRegistry {
  public trainerRepo: ITrainerRepository;
  public leaderboardRepo: ILeaderboardRepository;
  public fanRepo: IFanRepository;
  public clubRepo: IClubRepository;
  public linkRepo: ILinkRepository;
  public milestoneRepo: IMilestoneRepository;

  public fanModule: FanGainKnowledgeModule;
  public leaderboardModule: LeaderboardKnowledgeModule;
  public linkModule: LinkRequestKnowledgeModule;
  public milestoneModule: MilestoneKnowledgeModule;
  public clubModule: ClubKnowledgeModule;

  constructor(options: DatabaseRegistryOptions = {}) {
    this.trainerRepo = options.trainerRepo || new DefaultTrainerRepository();
    this.leaderboardRepo = options.leaderboardRepo || new DefaultLeaderboardRepository();
    this.fanRepo = options.fanRepo || new DefaultFanRepository();
    this.clubRepo = options.clubRepo || new DefaultClubRepository();
    this.linkRepo = options.linkRepo || new DefaultLinkRepository();
    this.milestoneRepo = options.milestoneRepo || new DefaultMilestoneRepository();

    this.fanModule = new FanGainKnowledgeModule(this.fanRepo);
    this.leaderboardModule = new LeaderboardKnowledgeModule(this.leaderboardRepo);
    this.linkModule = new LinkRequestKnowledgeModule(this.linkRepo);
    this.milestoneModule = new MilestoneKnowledgeModule(this.milestoneRepo, this.fanRepo);
    this.clubModule = new ClubKnowledgeModule(this.clubRepo);
  }

  public getDomains(): string[] {
    return [
      'Trainers',
      'Members',
      'Clubs',
      'Fan Gain',
      'Fan Deficit',
      'Fan Surplus',
      'Leaderboards',
      'Link Requests',
      'Milestones',
      'Attendance',
      'Activity Tracking',
      'Bot Configuration'
    ];
  }
}
