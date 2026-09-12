import { FanCalculator } from '../fan/fan-calculator.js';
import { FAN_MILESTONES, TrainerFanData } from '../fan/fan-types.js';
import {
  ClubMemberData,
  ClubStatsResult,
  LeaderboardEntry,
  LeaderboardResult,
  MemberRankResult
} from './leaderboard-types.js';

export class LeaderboardCalculator {
  /**
   * Calculates a member's rank within the club, distance to the next rank,
   * and current standing without duplicating ranking algorithms.
   */
  public static calculateMemberRank(
    members: ClubMemberData[],
    trainerIdOrName: string
  ): MemberRankResult | null {
    if (!members || members.length === 0) {
      return null;
    }

    const sorted = [...members].sort((a, b) => b.fans - a.fans);
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

  /**
   * Computes the ordered leaderboard and enriches each entry with B1 fan calculations
   * (Milestone Status, Deficit Status, Monthly Gain).
   */
  public static calculateLeaderboard(
    members: ClubMemberData[],
    limit?: number
  ): LeaderboardResult {
    const sorted = [...members].sort((a, b) => b.fans - a.fans);
    const sliced = limit && limit > 0 ? sorted.slice(0, limit) : sorted;

    const entries: LeaderboardEntry[] = sliced.map((m, idx) => {
      const fanData: TrainerFanData = {
        trainerId: m.trainerId,
        trainerName: m.trainerName,
        dailyGain: m.dailyGain ?? 0,
        totalFans: m.fans
      };

      const milestone = FanCalculator.calculateMilestones(fanData);
      const deficit = FanCalculator.calculateDeficit(fanData);

      return {
        rank: idx + 1,
        trainerName: m.trainerName,
        fans: m.fans,
        trainerId: m.trainerId,
        monthlyGain: m.monthlyGain ?? m.fans,
        deficitStatus: deficit.deficit > 0 ? 'behind_pace' : 'on_pace',
        milestoneStatus: milestone.currentMilestone
      };
    });

    return {
      entries,
      totalMembers: sorted.length,
      limit
    };
  }

  /**
   * Computes aggregate club statistics from member fan data.
   */
  public static calculateClubStats(members: ClubMemberData[]): ClubStatsResult {
    const memberCount = members.length;
    if (memberCount === 0) {
      return {
        totalFans: 0,
        averageFans: 0,
        memberCount: 0,
        clubStatus: 'Minimum',
        clubName: 'Umakraft'
      };
    }

    const totalFans = members.reduce((sum, m) => sum + m.fans, 0);
    const averageFans = Math.round(totalFans / memberCount);

    let clubStatus = 'Minimum';
    if (averageFans >= 300_000_000 || totalFans >= 7_500_000_000) {
      clubStatus = 'Super Competitive';
    } else if (averageFans >= 200_000_000) {
      clubStatus = 'Competitive';
    }

    return {
      totalFans,
      averageFans,
      memberCount,
      clubStatus,
      clubName: 'Umakraft'
    };
  }

  /**
   * Finds members who have reached a given milestone (e.g. 'Super Competitive').
   */
  public static findReachedMilestone(members: ClubMemberData[], milestoneTitle: string): ClubMemberData[] {
    const target = FAN_MILESTONES.find(m => m.title.toLowerCase() === milestoneTitle.toLowerCase());
    if (!target) return [];
    return members.filter(m => m.fans >= target.fans);
  }

  /**
   * Finds members who are currently behind minimum pace (using B1 FanCalculator).
   */
  public static findBehindPace(members: ClubMemberData[]): ClubMemberData[] {
    return members.filter(m => {
      const deficit = FanCalculator.calculateDeficit({
        trainerId: m.trainerId,
        totalFans: m.fans,
        dailyGain: m.dailyGain ?? 0
      });
      return deficit.deficit > 0;
    });
  }

  /**
   * Finds the member closest to a given target fan count (e.g. 300M).
   */
  public static findClosestTo(members: ClubMemberData[], targetFans: number): { member: ClubMemberData; distance: number } | null {
    if (!members || members.length === 0) return null;

    let closest = members[0];
    let minDiff = Math.abs(members[0].fans - targetFans);

    for (let i = 1; i < members.length; i++) {
      const diff = Math.abs(members[i].fans - targetFans);
      if (diff < minDiff) {
        minDiff = diff;
        closest = members[i];
      }
    }

    return {
      member: closest,
      distance: minDiff
    };
  }
}
