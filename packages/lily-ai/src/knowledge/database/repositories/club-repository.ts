import { ClubEntity } from './repository-types.js';
import { defaultLeaderboardDataProvider, ILeaderboardDataProvider } from '../../../tools/leaderboard/leaderboard-types.js';

export interface IClubRepository {
  getClubById(clubId: string): Promise<ClubEntity | null>;
  getClubByName(clubName: string): Promise<ClubEntity | null>;
  getDefaultClub(): Promise<ClubEntity>;
  saveClub(club: ClubEntity): Promise<void>;
}

export class DefaultClubRepository implements IClubRepository {
  private provider: ILeaderboardDataProvider;
  private customClubs = new Map<string, ClubEntity>();

  constructor(provider?: ILeaderboardDataProvider) {
    this.provider = provider || defaultLeaderboardDataProvider;
  }

  public async getDefaultClub(): Promise<ClubEntity> {
    const defaultId = '974470619';
    if (this.customClubs.has(defaultId)) {
      return this.customClubs.get(defaultId)!;
    }

    const stats = await this.provider.getClubStats();
    const members = await this.provider.getMembers();

    return {
      clubId: defaultId,
      clubName: 'Umakraft',
      memberCount: members.length || stats.memberCount || 30,
      maxMembers: 30,
      totalFans: stats.totalFans || 7_800_000_000,
      monthlyFanTarget: 150_000_000,
      averageFans: stats.averageFans || 260_000_000,
      status: (stats.clubStatus as any) || 'Super Competitive',
      rank: 1,
      leaderTrainerId: '123456'
    };
  }

  public async getClubById(clubId: string): Promise<ClubEntity | null> {
    if (this.customClubs.has(clubId)) {
      return this.customClubs.get(clubId)!;
    }
    if (clubId === '974470619' || clubId.toLowerCase() === 'umakraft') {
      return this.getDefaultClub();
    }
    return null;
  }

  public async getClubByName(clubName: string): Promise<ClubEntity | null> {
    if (clubName.trim().toLowerCase() === 'umakraft') {
      return this.getDefaultClub();
    }
    for (const club of this.customClubs.values()) {
      if (club.clubName.toLowerCase() === clubName.trim().toLowerCase()) {
        return club;
      }
    }
    return null;
  }

  public async saveClub(club: ClubEntity): Promise<void> {
    this.customClubs.set(club.clubId, club);
  }
}
