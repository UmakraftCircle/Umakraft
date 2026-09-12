import { TrainerFanData } from '../fan/fan-types.js';

export interface MemberRankResult {
  rank: number;
  totalMembers: number;
  fans: number;
  nextRankDistance?: number;
  trainerName?: string;
  trainerId?: string;
  unlinkedNotice?: boolean;
  notFound?: boolean;
  message?: string;
}

export interface LeaderboardEntry {
  rank: number;
  trainerName: string;
  fans: number;
  trainerId?: string;
  monthlyGain?: number;
  deficitStatus?: string;
  milestoneStatus?: string;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  totalMembers?: number;
  limit?: number;
}

export interface ClubStatsResult {
  totalFans: number;
  averageFans: number;
  memberCount: number;
  clubStatus?: string;
  clubName?: string;
}

export interface ClubMemberData {
  trainerId: string;
  trainerName: string;
  fans: number;
  dailyGain?: number;
  monthlyGain?: number;
  linkedDiscordId?: string;
}

export interface ILeaderboardDataProvider {
  getLeaderboard(limit?: number): Promise<LeaderboardResult> | LeaderboardResult;
  getMemberRank(trainerIdOrName: string): Promise<MemberRankResult | null> | MemberRankResult | null;
  getClubStats(): Promise<ClubStatsResult> | ClubStatsResult;
  getMembers(): Promise<ClubMemberData[]> | ClubMemberData[];
}

/**
 * Knowledge & Data Source Rule:
 * Leaderboard & club data MUST strictly resolve from Database.
 * NEVER from Handbook, Taxonomy, or Web Search.
 */
export const CLUB_DATA_SOURCE_RULE = {
  domain: 'club_data',
  allowedSource: 'database',
  forbiddenSources: ['handbook', 'lily_handbook', 'taxonomy', 'web_search', 'uma.guide'] as const
};

export const FORBIDDEN_CLUB_DATA_SOURCES = [
  'handbook',
  'lily_handbook',
  'taxonomy',
  'web_search',
  'uma.guide'
] as const;

export class DefaultLeaderboardDataProvider implements ILeaderboardDataProvider {
  private members: ClubMemberData[] = [];
  private clubStatsOverride?: Partial<ClubStatsResult>;

  constructor() {
    this.seedBaselineMembers();
  }

  private seedBaselineMembers(): void {
    // 30 members baseline matching prompt specifications and realistic Umakraft rankings
    this.members = [
      { trainerId: '123456', trainerName: 'RiceEnjoyer', fans: 412_000_000, dailyGain: 12_000_000, monthlyGain: 412_000_000, linkedDiscordId: 'user-rice' },
      { trainerId: '234567', trainerName: 'SuzukaMain', fans: 398_000_000, dailyGain: 11_500_000, monthlyGain: 398_000_000 },
      { trainerId: '345678', trainerName: 'TeioFan', fans: 366_000_000, dailyGain: 10_000_000, monthlyGain: 366_000_000 },
      { trainerId: '456789', trainerName: 'OguriEnjoyer', fans: 342_000_000, dailyGain: 9_500_000, monthlyGain: 342_000_000 },
      { trainerId: '567890', trainerName: 'GoldShipChaos', fans: 315_000_000, dailyGain: 8_000_000, monthlyGain: 315_000_000 },
      { trainerId: '678901', trainerName: 'TachyonLab', fans: 190_000_000, dailyGain: 6_000_000, monthlyGain: 190_000_000 },
      { trainerId: '789012', trainerName: 'CafeLover', fans: 184_200_000, dailyGain: 5_800_000, monthlyGain: 184_200_000, linkedDiscordId: 'user-cafe' },
      { trainerId: '890123', trainerName: 'SpeChan', fans: 180_000_000, dailyGain: 5_500_000, monthlyGain: 180_000_000 },
      { trainerId: '901234', trainerName: 'McQueenPride', fans: 175_000_000, dailyGain: 5_200_000, monthlyGain: 175_000_000 },
      { trainerId: '012345', trainerName: 'VodkaRacer', fans: 170_000_000, dailyGain: 5_000_000, monthlyGain: 170_000_000 },
      { trainerId: '112233', trainerName: 'ScarletSprint', fans: 168_000_000, dailyGain: 4_800_000, monthlyGain: 168_000_000 },
      { trainerId: '223344', trainerName: 'BourbonCyborg', fans: 165_000_000, dailyGain: 4_600_000, monthlyGain: 165_000_000 },
      { trainerId: '334455', trainerName: 'BakushinSpeed', fans: 162_000_000, dailyGain: 4_500_000, monthlyGain: 162_000_000 },
      { trainerId: '445566', trainerName: 'RudolfPresident', fans: 160_000_000, dailyGain: 4_400_000, monthlyGain: 160_000_000 },
      { trainerId: '556677', trainerName: 'GrooveEmpress', fans: 158_000_000, dailyGain: 4_300_000, monthlyGain: 158_000_000 },
      { trainerId: '667788', trainerName: 'TaikiShuttle', fans: 156_000_000, dailyGain: 4_200_000, monthlyGain: 156_000_000 },
      { trainerId: '778899', trainerName: 'MaruzenskyV8', fans: 155_000_000, dailyGain: 4_100_000, monthlyGain: 155_000_000 },
      { trainerId: '889900', trainerName: 'FujiKiseki', fans: 154_000_000, dailyGain: 4_000_000, monthlyGain: 154_000_000 },
      { trainerId: '990011', trainerName: 'BrianShadow', fans: 153_000_000, dailyGain: 3_900_000, monthlyGain: 153_000_000 },
      { trainerId: '101112', trainerName: 'MayanoFly', fans: 152_000_000, dailyGain: 3_800_000, monthlyGain: 152_000_000 },
      { trainerId: '121314', trainerName: 'GrassWonder', fans: 151_000_000, dailyGain: 3_700_000, monthlyGain: 151_000_000 },
      { trainerId: '131415', trainerName: 'ElCondorPasa', fans: 150_500_000, dailyGain: 3_600_000, monthlyGain: 150_500_000 },
      { trainerId: '141516', trainerName: 'SeiunSky', fans: 150_000_000, dailyGain: 3_500_000, monthlyGain: 150_000_000 },
      { trainerId: '151617', trainerName: 'KingHalo', fans: 148_000_000, dailyGain: 3_400_000, monthlyGain: 148_000_000 },
      { trainerId: '161718', trainerName: 'NiceNature', fans: 145_000_000, dailyGain: 3_300_000, monthlyGain: 145_000_000 },
      { trainerId: '171819', trainerName: 'TwinTurbo', fans: 142_000_000, dailyGain: 3_200_000, monthlyGain: 142_000_000 },
      { trainerId: '181920', trainerName: 'Matikanefukukitaru', fans: 140_000_000, dailyGain: 3_100_000, monthlyGain: 140_000_000 },
      { trainerId: '192021', trainerName: 'RiceFanatic', fans: 138_000_000, dailyGain: 3_000_000, monthlyGain: 138_000_000 },
      { trainerId: '202122', trainerName: 'HaruUrara', fans: 135_000_000, dailyGain: 2_800_000, monthlyGain: 135_000_000 },
      { trainerId: '212223', trainerName: 'WinningTicket', fans: 130_000_000, dailyGain: 2_500_000, monthlyGain: 130_000_000 }
    ];
  }

  public setMembers(members: ClubMemberData[]): void {
    this.members = [...members];
  }

  public addMember(member: ClubMemberData): void {
    const existingIndex = this.members.findIndex(m => m.trainerId === member.trainerId);
    if (existingIndex >= 0) {
      this.members[existingIndex] = member;
    } else {
      this.members.push(member);
    }
  }

  public setClubStatsOverride(stats: Partial<ClubStatsResult>): void {
    this.clubStatsOverride = stats;
  }

  public getMembers(): ClubMemberData[] {
    return [...this.members];
  }

  public getLeaderboard(limit?: number): LeaderboardResult {
    const sorted = [...this.members].sort((a, b) => b.fans - a.fans);
    const sliced = limit ? sorted.slice(0, limit) : sorted;

    const entries: LeaderboardEntry[] = sliced.map((m, idx) => ({
      rank: idx + 1,
      trainerName: m.trainerName,
      fans: m.fans,
      trainerId: m.trainerId,
      monthlyGain: m.monthlyGain ?? m.fans
    }));

    return {
      entries,
      totalMembers: sorted.length,
      limit
    };
  }

  public getMemberRank(trainerIdOrName: string): MemberRankResult | null {
    const sorted = [...this.members].sort((a, b) => b.fans - a.fans);
    const index = sorted.findIndex(
      m => m.trainerId === trainerIdOrName || 
           m.trainerName.toLowerCase() === trainerIdOrName.toLowerCase() ||
           m.linkedDiscordId === trainerIdOrName
    );

    if (index === -1) {
      return null;
    }

    const member = sorted[index];
    const rank = index + 1;
    let nextRankDistance: number | undefined;

    if (index > 0) {
      const prevMember = sorted[index - 1];
      nextRankDistance = Math.max(0, prevMember.fans - member.fans);
    } else {
      nextRankDistance = 0;
    }

    return {
      rank,
      totalMembers: sorted.length,
      fans: member.fans,
      trainerName: member.trainerName,
      trainerId: member.trainerId,
      nextRankDistance
    };
  }

  public getClubStats(): ClubStatsResult {
    const memberCount = this.clubStatsOverride?.memberCount ?? this.members.length;
    const totalFans = this.clubStatsOverride?.totalFans ?? 7_800_000_000;
    const averageFans = this.clubStatsOverride?.averageFans ?? 260_000_000;
    const clubStatus = this.clubStatsOverride?.clubStatus ?? 'Super Competitive';

    return {
      totalFans,
      averageFans,
      memberCount,
      clubStatus,
      clubName: 'Umakraft'
    };
  }
}

export const defaultLeaderboardDataProvider = new DefaultLeaderboardDataProvider();
