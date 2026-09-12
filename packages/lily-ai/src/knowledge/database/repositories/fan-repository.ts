import { FanStatsEntity } from './repository-types.js';
import { defaultFanDataProvider, IFanDataProvider, FAN_MILESTONES } from '../../../tools/fan/fan-types.js';
import { defaultLeaderboardDataProvider, ILeaderboardDataProvider } from '../../../tools/leaderboard/leaderboard-types.js';

export interface IFanRepository {
  getStatsByTrainerId(trainerId: string): Promise<FanStatsEntity | null>;
  getStatsByTrainerName(trainerName: string): Promise<FanStatsEntity | null>;
  saveStats(stats: FanStatsEntity): Promise<void>;
}

export class DefaultFanRepository implements IFanRepository {
  private fanProvider: IFanDataProvider;
  private leaderboardProvider: ILeaderboardDataProvider;
  private customStats = new Map<string, FanStatsEntity>();

  constructor(fanProvider?: IFanDataProvider, leaderboardProvider?: ILeaderboardDataProvider) {
    this.fanProvider = fanProvider || defaultFanDataProvider;
    this.leaderboardProvider = leaderboardProvider || defaultLeaderboardDataProvider;
  }

  public async getStatsByTrainerId(trainerId: string): Promise<FanStatsEntity | null> {
    if (this.customStats.has(trainerId)) {
      return this.customStats.get(trainerId)!;
    }

    // 1. Check leaderboard members first for exact synced numbers
    const members = await this.leaderboardProvider.getMembers();
    const member = members.find(m => m.trainerId === trainerId);

    const now = new Date();
    const currentDay = Math.max(1, now.getDate());
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    let totalFans = 0;
    let dailyGain = 0;
    let monthlyGain = 0;
    let trainerName = 'Trainer';

    if (member) {
      totalFans = member.fans;
      dailyGain = member.dailyGain || Math.round(member.fans / currentDay);
      monthlyGain = member.monthlyGain || member.fans;
      trainerName = member.trainerName;
    } else {
      const fallback = await this.fanProvider.getTrainerFanData(trainerId);
      if (fallback) {
        totalFans = fallback.totalFans;
        dailyGain = fallback.dailyGain;
        monthlyGain = fallback.totalFans;
        trainerName = fallback.trainerName || 'Trainer';
      } else {
        return null;
      }
    }

    // Determine current & next milestone
    let currentMilestone = 'None';
    let nextMilestone: string | undefined = FAN_MILESTONES[0].title;
    let nextTargetFans = FAN_MILESTONES[0].fans;

    for (let i = 0; i < FAN_MILESTONES.length; i++) {
      if (totalFans >= FAN_MILESTONES[i].fans) {
        currentMilestone = FAN_MILESTONES[i].title;
        if (i + 1 < FAN_MILESTONES.length) {
          nextMilestone = FAN_MILESTONES[i + 1].title;
          nextTargetFans = FAN_MILESTONES[i + 1].fans;
        } else {
          nextMilestone = undefined;
        }
      }
    }

    const remainingFansToNextMilestone = nextMilestone ? Math.max(0, nextTargetFans - totalFans) : 0;

    // Deficit / surplus based on 150M minimum pace
    const targetPacePerDay = 150_000_000 / daysInMonth;
    const expectedFansToDate = targetPacePerDay * currentDay;
    const deficit = totalFans < expectedFansToDate ? Math.round(expectedFansToDate - totalFans) : 0;
    const surplus = totalFans > expectedFansToDate ? Math.round(totalFans - expectedFansToDate) : 0;

    const remainingDays = Math.max(1, daysInMonth - currentDay);
    const requiredDailyGain = remainingFansToNextMilestone > 0
      ? Math.round(remainingFansToNextMilestone / remainingDays)
      : 0;

    const projectedMonthEnd = Math.round(totalFans + dailyGain * remainingDays);

    const result: FanStatsEntity = {
      trainerId,
      trainerName,
      totalFans,
      dailyGain,
      monthlyGain,
      currentDay,
      daysInMonth,
      currentMilestone,
      nextMilestone,
      remainingFansToNextMilestone,
      deficit,
      surplus,
      requiredDailyGain,
      projectedMonthEnd
    };

    return result;
  }

  public async getStatsByTrainerName(trainerName: string): Promise<FanStatsEntity | null> {
    const members = await this.leaderboardProvider.getMembers();
    const lower = trainerName.trim().toLowerCase();
    const member = members.find(m => m.trainerName.toLowerCase() === lower || m.trainerName.toLowerCase().includes(lower));

    if (member) {
      return this.getStatsByTrainerId(member.trainerId);
    }

    return null;
  }

  public async saveStats(stats: FanStatsEntity): Promise<void> {
    this.customStats.set(stats.trainerId, stats);
  }
}
