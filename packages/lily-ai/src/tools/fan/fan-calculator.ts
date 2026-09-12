import {
  FAN_MILESTONES,
  FanGainResult,
  FanDeficitResult,
  FanSurplusResult,
  FanProjectionResult,
  FanMilestoneResult,
  TrainerFanData
} from './fan-types.js';

export class FanCalculator {
  /**
   * Calculates Fan Gain result.
   */
  public static calculateGain(data: TrainerFanData): FanGainResult {
    return {
      gainedToday: data.dailyGain,
      totalFans: data.totalFans
    };
  }

  /**
   * Calculates Deficit based on 150M minimum milestone target pace.
   */
  public static calculateDeficit(data: TrainerFanData): FanDeficitResult {
    const now = new Date();
    const currentDay = data.currentDay ?? Math.max(1, now.getDate());
    const daysInMonth = data.daysInMonth ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = Math.max(1, daysInMonth - currentDay);

    const minTarget = FAN_MILESTONES[0].fans; // 150_000_000
    const dailyTarget = minTarget / daysInMonth;
    const expectedFans = Math.round(dailyTarget * currentDay);

    const deficit = Math.max(0, expectedFans - data.totalFans);
    const remainingToTarget = Math.max(0, minTarget - data.totalFans);
    const requiredDailyGain = Math.round(remainingToTarget / remainingDays);
    const currentAverage = Math.round(data.totalFans / currentDay);

    return {
      requiredDailyGain,
      currentAverage,
      deficit
    };
  }

  /**
   * Calculates Surplus and projected month-end fan total.
   */
  public static calculateSurplus(data: TrainerFanData): FanSurplusResult {
    const now = new Date();
    const currentDay = data.currentDay ?? Math.max(1, now.getDate());
    const daysInMonth = data.daysInMonth ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const minTarget = FAN_MILESTONES[0].fans; // 150M
    const dailyTarget = minTarget / daysInMonth;
    const expectedFans = Math.round(dailyTarget * currentDay);

    const surplus = Math.max(0, data.totalFans - expectedFans);
    const projectedMonthEnd = Math.round((data.totalFans / currentDay) * daysInMonth);

    return {
      surplus,
      projectedMonthEnd
    };
  }

  /**
   * Calculates Month-End Projection and highest projected milestone.
   */
  public static calculateProjection(data: TrainerFanData): FanProjectionResult {
    const now = new Date();
    const currentDay = data.currentDay ?? Math.max(1, now.getDate());
    const daysInMonth = data.daysInMonth ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const projectedFans = Math.round((data.totalFans / currentDay) * daysInMonth);

    let projectedMilestone = 'Below Minimum';
    for (const m of FAN_MILESTONES) {
      if (projectedFans >= m.fans) {
        projectedMilestone = m.title;
      }
    }

    return {
      projectedFans,
      projectedMilestone
    };
  }

  /**
   * Calculates current achieved milestone and distance to next milestone.
   */
  public static calculateMilestones(data: TrainerFanData): FanMilestoneResult {
    const sorted = [...FAN_MILESTONES].sort((a, b) => a.fans - b.fans);

    let currentMilestone = 'Below Minimum';
    let nextMilestone: string | undefined = sorted[0].title;
    let remainingFans: number | undefined = Math.max(0, sorted[0].fans - data.totalFans);

    for (let i = 0; i < sorted.length; i++) {
      if (data.totalFans >= sorted[i].fans) {
        currentMilestone = sorted[i].title;
        if (i + 1 < sorted.length) {
          nextMilestone = sorted[i + 1].title;
          remainingFans = Math.max(0, sorted[i + 1].fans - data.totalFans);
        } else {
          nextMilestone = undefined;
          remainingFans = 0;
        }
      }
    }

    return {
      currentMilestone,
      nextMilestone,
      remainingFans
    };
  }
}
