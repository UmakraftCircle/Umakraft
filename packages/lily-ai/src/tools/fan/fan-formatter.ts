import {
  FanGainResult,
  FanDeficitResult,
  FanSurplusResult,
  FanProjectionResult,
  FanMilestoneResult
} from './fan-types.js';

export function formatMillions(num: number): string {
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (num >= 1_000) {
    const k = num / 1_000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return num.toLocaleString();
}

export class FanFormatter {
  public static formatGain(result: FanGainResult): string {
    return `Trainer, you gained ${formatMillions(result.gainedToday)} fans today.\n\nYour total is now ${formatMillions(result.totalFans)} fans.`;
  }

  public static formatDeficit(result: FanDeficitResult): string {
    if (result.deficit <= 0) {
      return `Trainer, you are currently on track with no deficit!\nYour daily average is ${formatMillions(result.currentAverage)} fans per day.`;
    }
    return `Trainer, you're currently ${formatMillions(result.deficit)} fans behind the minimum pace.\n\nTo recover, you'll need about ${formatMillions(result.requiredDailyGain)} fans per day.`;
  }

  public static formatSurplus(result: FanSurplusResult): string {
    if (result.surplus <= 0) {
      return `Trainer, you are currently at target pace. Projected month-end: ${formatMillions(result.projectedMonthEnd)} fans.`;
    }
    return `Trainer, you are currently ${formatMillions(result.surplus)} fans ahead of pace!\n\nProjected month-end total: ${formatMillions(result.projectedMonthEnd)} fans.`;
  }

  public static formatProjection(result: FanProjectionResult): string {
    return `Trainer, based on your current pace, you are projected to reach ${formatMillions(result.projectedFans)} fans by month-end (Milestone: ${result.projectedMilestone}).`;
  }

  public static formatMilestone(result: FanMilestoneResult): string {
    if (result.nextMilestone && result.remainingFans) {
      if (result.currentMilestone === 'Below Minimum') {
        return `Trainer, you are currently working towards the ${result.nextMilestone} milestone.\n\nRemaining: ${formatMillions(result.remainingFans)} fans.`;
      }
      return `Congratulations!\n\nYou've reached the ${result.currentMilestone} milestone.\n\nNext target:\n${result.nextMilestone}.\nRemaining: ${formatMillions(result.remainingFans)} fans.`;
    }
    return `Congratulations!\n\nYou've reached the top milestone: ${result.currentMilestone}! Outstanding work, Trainer!`;
  }
}
