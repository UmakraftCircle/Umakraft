export interface FanGainResult {
  gainedToday: number;
  totalFans: number;
}

export interface FanDeficitResult {
  requiredDailyGain: number;
  currentAverage: number;
  deficit: number;
}

export interface FanSurplusResult {
  surplus: number;
  projectedMonthEnd: number;
}

export interface FanProjectionResult {
  projectedFans: number;
  projectedMilestone: string;
}

export interface FanMilestoneResult {
  currentMilestone: string;
  nextMilestone?: string;
  remainingFans?: number;
}

export interface FanMilestoneConfig {
  fans: number;
  title: string;
}

/**
 * Single source of truth for Umakraft fan milestones.
 * Kept strictly isolated from prompt strings.
 */
export const FAN_MILESTONES: FanMilestoneConfig[] = [
  {
    fans: 150_000_000,
    title: "Minimum"
  },
  {
    fans: 200_000_000,
    title: "Competitive"
  },
  {
    fans: 300_000_000,
    title: "Super Competitive"
  }
];

export interface TrainerFanData {
  trainerId: string;
  trainerName?: string;
  dailyGain: number;
  totalFans: number;
  currentDay?: number;
  daysInMonth?: number;
}

export interface IFanDataProvider {
  getTrainerFanData(trainerId: string): Promise<TrainerFanData> | TrainerFanData;
}

export class DefaultFanDataProvider implements IFanDataProvider {
  private dataStore = new Map<string, TrainerFanData>();

  public setTrainerFanData(data: TrainerFanData) {
    this.dataStore.set(data.trainerId, data);
  }

  public getTrainerFanData(trainerId: string): TrainerFanData {
    if (this.dataStore.has(trainerId)) {
      return this.dataStore.get(trainerId)!;
    }
    return {
      trainerId,
      trainerName: 'Trainer',
      dailyGain: 5_200_000,
      totalFans: 167_400_000
    };
  }
}

export const defaultFanDataProvider = new DefaultFanDataProvider();
