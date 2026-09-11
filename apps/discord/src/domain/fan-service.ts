import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('FanService');

export interface FanStats {
  trainerId: string;
  currentFans: number;
  targetFans: number;
  dailyGain: number;
  deficit: number;
  surplus: number;
}

export class FanService {
  private static instance: FanService;
  private fanStore: Map<string, FanStats> = new Map();

  public static getInstance(): FanService {
    if (!FanService.instance) {
      FanService.instance = new FanService();
    }
    return FanService.instance;
  }

  public getFanStats(trainerId: string): FanStats {
    if (!this.fanStore.has(trainerId)) {
      // Default initial mock stats for demo/testing
      this.fanStore.set(trainerId, {
        trainerId,
        currentFans: 120_000_000,
        targetFans: 150_000_000,
        dailyGain: 2_500_000,
        deficit: 30_000_000,
        surplus: 0,
      });
    }
    return this.fanStore.get(trainerId)!;
  }

  public updateFanGain(trainerId: string, dailyGain: number): FanStats {
    const stats = this.getFanStats(trainerId);
    stats.dailyGain = dailyGain;
    stats.currentFans += dailyGain;
    stats.deficit = Math.max(0, stats.targetFans - stats.currentFans);
    stats.surplus = Math.max(0, stats.currentFans - stats.targetFans);
    this.fanStore.set(trainerId, stats);
    logger.info(`[FanService] Updated fan stats for ${trainerId}: gain=${dailyGain}, total=${stats.currentFans}`);
    return stats;
  }

  public calculateMilestone(trainerId: string): string {
    const stats = this.getFanStats(trainerId);
    const pct = ((stats.currentFans / stats.targetFans) * 100).toFixed(1);
    return `You have reached ${pct}% of your monthly target (${stats.currentFans.toLocaleString()} / ${stats.targetFans.toLocaleString()} fans).`;
  }
}

export const fanService = FanService.getInstance();
