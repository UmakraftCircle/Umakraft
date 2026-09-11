import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('LeaderboardService');

export interface LeaderboardEntry {
  rank: number;
  trainerName: string;
  fans: number;
}

export class LeaderboardService {
  private static instance: LeaderboardService;
  private rankings: LeaderboardEntry[] = [
    { rank: 1, trainerName: 'Air Groove Fan', fans: 210_000_000 },
    { rank: 2, trainerName: 'Special Week', fans: 195_000_000 },
    { rank: 3, trainerName: 'Tokai Teio', fans: 180_000_000 },
    { rank: 15, trainerName: 'Default Trainer', fans: 120_000_000 },
  ];

  public static getInstance(): LeaderboardService {
    if (!LeaderboardService.instance) {
      LeaderboardService.instance = new LeaderboardService();
    }
    return LeaderboardService.instance;
  }

  public getRank(trainerId: string): number {
    return 15; // default rank for demo
  }

  public getTop10(): LeaderboardEntry[] {
    return this.rankings.slice(0, 10);
  }

  public getNearbyRanks(trainerId: string): LeaderboardEntry[] {
    return this.rankings.slice(2, 6);
  }
}

export const leaderboardService = LeaderboardService.getInstance();
