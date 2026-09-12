import { LeaderboardEntryEntity } from './repository-types.js';
import { defaultLeaderboardDataProvider, ILeaderboardDataProvider } from '../../../tools/leaderboard/leaderboard-types.js';

export interface ILeaderboardRepository {
  getEntries(limit?: number, offset?: number): Promise<LeaderboardEntryEntity[]>;
  getRankByTrainerId(trainerId: string): Promise<LeaderboardEntryEntity | null>;
  getRankByName(trainerName: string): Promise<LeaderboardEntryEntity | null>;
  getTotalCount(): Promise<number>;
}

export class DefaultLeaderboardRepository implements ILeaderboardRepository {
  private provider: ILeaderboardDataProvider;

  constructor(provider?: ILeaderboardDataProvider) {
    this.provider = provider || defaultLeaderboardDataProvider;
  }

  public async getEntries(limit: number = 30, offset: number = 0): Promise<LeaderboardEntryEntity[]> {
    const raw = await this.provider.getLeaderboard(100);
    const members = await this.provider.getMembers();

    const entities: LeaderboardEntryEntity[] = raw.entries.map(entry => {
      const member = members.find(m => m.trainerName === entry.trainerName || m.trainerId === entry.trainerId);
      return {
        rank: entry.rank,
        trainerId: entry.trainerId || member?.trainerId || `trainer_${entry.rank}`,
        trainerName: entry.trainerName,
        fans: entry.fans,
        dailyGain: member?.dailyGain ?? Math.round(entry.fans / 30),
        monthlyGain: entry.monthlyGain ?? entry.fans,
        linkedDiscordId: member?.linkedDiscordId
      };
    });

    return entities.slice(offset, offset + limit);
  }

  public async getRankByTrainerId(trainerId: string): Promise<LeaderboardEntryEntity | null> {
    const all = await this.getEntries(100, 0);
    const found = all.find(e => e.trainerId === trainerId);
    return found || null;
  }

  public async getRankByName(trainerName: string): Promise<LeaderboardEntryEntity | null> {
    const all = await this.getEntries(100, 0);
    const lower = trainerName.trim().toLowerCase();
    const found = all.find(e => e.trainerName.toLowerCase() === lower || e.trainerName.toLowerCase().includes(lower));
    return found || null;
  }

  public async getTotalCount(): Promise<number> {
    const raw = await this.provider.getLeaderboard();
    return raw.totalMembers || raw.entries.length;
  }
}
