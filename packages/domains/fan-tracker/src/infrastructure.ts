import { createLogger } from '@ai-agent-platform/shared';
import { CacheStore } from '@ai-agent-platform/core';

const logger = createLogger('FanTrackerInfra');

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxReqsPerSec = 1) {
    this.maxTokens = maxReqsPerSec;
    this.tokens = maxReqsPerSec;
    this.lastRefill = Date.now();
    this.refillRate = maxReqsPerSec / 1000;
  }

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = now - this.lastRefill;
      this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
      this.lastRefill = now;
      if (this.tokens >= 1) { this.tokens -= 1; return; }
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

const cache = new CacheStore({ namespace: 'fan-tracker', defaultTTL: 5 * 60 * 1000 });

export interface TrainerStats {
  trainerId: string;
  trainerName: string;
  totalFans: number;
  monthlyFans: number;
  dailyGain: number;
  weeklyGain: number;
  gain3d: number | null;
  gain7d: number | null;
  gain30d: number | null;
  monthlyRank: number | null;
  rank3d: number | null;
  rank7d: number | null;
  rank30d: number | null;
  activeDays: number;
  avgDaily: number | null;
  avg3d: number | null;
  avg7d: number | null;
  clubRankTier: string;
  previousCircleName: string | null;
  updatedAt: string;
  isActive: boolean;
}

export interface TrendAnalysis {
  trainerId: string;
  period: string;
  gain: number;
  rank: number | null;
  avgFansPerDay: number | null;
  growthVelocity: string;
  historicalFans: Array<{ date: string; count: number }>;
}

export interface RankThreshold {
  rank_index: number;
  name: string;
  ranking_from: number | null;
  ranking_to: number | null;
  current_min_fans: number | null;
  current_fans_per_day: number | null;
  yesterday_min_fans: number | null;
  daily_fans_delta: number | null;
}

export class FanTrackerAPI {
  private circleId: string;
  private apiKey: string;
  private baseUrl: string;
  private limiter: RateLimiter;

  constructor(circleId?: string, apiKey?: string) {
    this.circleId = circleId || process.env['UMAMOE_CIRCLE_ID'] || '974470619';
    this.apiKey = apiKey || process.env['UMAMOE_API_KEY'] || '';
    this.baseUrl = 'https://uma.moe';
    this.limiter = new RateLimiter(1);
  }

  private async apiGet<T>(path: string, cacheKey?: string, ttl?: number): Promise<T> {
    if (cacheKey) {
      const cached = cache.get<T>(cacheKey);
      if (cached) return cached;
    }
    await this.limiter.acquire();
    const headers: Record<string, string> = { 'Accept-Encoding': 'gzip, deflate' };
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;
    const url = `${this.baseUrl}${path}`;
    logger.debug(`API GET ${url}`);
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`uma.moe API ${res.status} for ${path}: ${text.slice(0, 200)}`);
    }
    const data = await res.json() as T;
    if (cacheKey) cache.set(cacheKey, data, ttl || 5 * 60 * 1000);
    return data;
  }

  public async fetchTrainerStats(trainerId: string): Promise<TrainerStats> {
    const cacheKey = `trainer-profile:${trainerId}`;
    try {
      const profile = await this.apiGet<any>(`/api/v4/user/profile/${trainerId}`, cacheKey, 5 * 60 * 1000);
      return this.mapProfileToStats(trainerId, profile);
    } catch (error: any) {
      logger.warn(`Profile fetch failed for ${trainerId}: ${error.message}. Falling back to circles data.`);
      return this.fetchTrainerStatsFromCircle(trainerId);
    }
  }

  private async fetchTrainerStatsFromCircle(trainerId: string): Promise<TrainerStats> {
    const members = await this.fetchAllMembers();
    const member = members.find(m => m.trainerId === trainerId);
    if (member) return member;
    logger.warn(`Trainer ${trainerId} not found in circle. Using mock.`);
    return this.generateMockStats(trainerId);
  }

  public async fetchAllMembers(): Promise<TrainerStats[]> {
    const cacheKey = `circle-members:${this.circleId}`;
    try {
      const data = await this.apiGet<any>(`/api/v4/circles?circle_id=${this.circleId}`, cacheKey, 10 * 60 * 1000);
      const members = data.members || [];
      const statsList: TrainerStats[] = [];
      for (const m of members) {
        const stats = this.mapCircleMemberToStats(m, data.circle);
        if (stats.isActive) statsList.push(stats);
      }
      if (statsList.length === 0 && members.length > 0) {
        logger.warn(`fetchAllMembers: all ${members.length} circle members filtered as inactive. Returning full unfiltered list as fallback.`);
        return members.map(m => this.mapCircleMemberToStats(m, data.circle));
      }
      return statsList;
    } catch (error: any) {
      logger.error(`Circle fetch failed: ${error.message}. Using mock roster.`);
      return this.getMockRoster().map(t => this.generateMockStats(t.trainerId));
    }
  }

  public async listAllTrainers(): Promise<Array<{ trainerId: string; trainerName: string; tier: string }>> {
    const members = await this.fetchAllMembers();
    return members.map(m => ({ trainerId: m.trainerId, trainerName: m.trainerName, tier: m.clubRankTier }));
  }

  public async analyzeTrends(trainerId: string, period: string = 'weekly'): Promise<TrendAnalysis> {
    const cacheKey = `trend:${trainerId}:${period}`;
    try {
      const profile = await this.apiGet<any>(`/api/v4/user/profile/${trainerId}`, cacheKey, 5 * 60 * 1000);
      const fanHistory = profile.fan_history || {};
      const rolling = fanHistory.rolling || {};
      const monthly = (fanHistory.monthly || [])[0] || {};
      const gainMap: Record<string, { gain: number; rank: number | null; avg: number }> = {
        daily: { gain: rolling.gain_3d || 0, rank: rolling.rank_3d ?? null, avg: monthly.avg_3d || 0 },
        weekly: { gain: rolling.gain_7d || 0, rank: rolling.rank_7d ?? null, avg: monthly.avg_7d || 0 },
        monthly: { gain: monthly.monthly_gain || 0, rank: monthly.rank ?? null, avg: monthly.avg_monthly || 0 },
      };
      const p = gainMap[period] || gainMap.weekly;
      const velocity = p.avg > 0 ? `${(p.gain / (p.avg * (period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1)) * 100).toFixed(1)}% ${period}` : 'N/A';
      return { trainerId, period, gain: p.gain, rank: p.rank, avgFansPerDay: p.avg, growthVelocity: velocity, historicalFans: [] };
    } catch (error: any) {
      logger.warn(`Trend analysis failed for ${trainerId}: ${error.message}`);
      return this.generateMockTrends(trainerId, period);
    }
  }

  public async fetchRankThresholds(): Promise<RankThreshold[]> {
    try {
      const data = await this.apiGet<any>('/api/v4/circles/rank-thresholds', 'rank-thresholds', 30 * 60 * 1000);
      return data.thresholds || [];
    } catch (error: any) {
      logger.warn(`Rank thresholds fetch failed: ${error.message}`);
      return [];
    }
  }

  public async getTierForRank(rank: number | null): Promise<string> {
    if (rank === null || rank === undefined) return '?';
    const thresholds = await this.fetchRankThresholds();
    for (const t of thresholds) {
      if (t.ranking_from !== null && t.ranking_to !== null && rank >= t.ranking_from && rank <= t.ranking_to) {
        return t.name;
      }
    }
    return '?';
  }

  public clearCache(): void { cache.clear(); logger.info('Fan tracker cache cleared.'); }
  public getCacheStats() { return cache.getStats(); }

  private async mapProfileToStats(trainerId: string, profile: any): Promise<TrainerStats> {
    const trainer = profile.trainer || {};
    const circle = profile.circle || {};
    const fanHistory = profile.fan_history || {};
    const rolling = fanHistory.rolling || {};
    const monthly = (fanHistory.monthly || [])[0] || {};
    const alltime = fanHistory.alltime || {};

    const monthlyRank = circle.monthly_rank ?? null;
    const tier = await this.getTierForRank(monthlyRank);

    // Always merge circles data for month-aware monthly fields.
    // Profile API monthly_gain/active_days can be stale at month
    // boundaries; mapCircleMemberToStats computes correct values.
    let monthlyFans = monthly.monthly_gain || 0;
    let activeDays = monthly.active_days || 0;
    let avgDaily: number | null = monthly.avg_daily ?? null;
    let dailyGain = rolling.gain_3d ? Math.round(rolling.gain_3d / 3) : 0;
    let weeklyGain = rolling.gain_7d || 0;
    let totalFans = alltime.total_fans || monthly.total_fans || 0;
    let previousCircleName: string | null = null;

    try {
      const members = await this.fetchAllMembers();
      const circleMember = members.find(m => m.trainerId === String(trainerId));
      if (circleMember) {
        monthlyFans = circleMember.monthlyFans;
        activeDays = circleMember.activeDays;
        avgDaily = circleMember.avgDaily;
        dailyGain = circleMember.dailyGain || dailyGain;
        weeklyGain = circleMember.weeklyGain || weeklyGain;
        totalFans = circleMember.totalFans || totalFans;
        previousCircleName = circleMember.previousCircleName;
      }
    } catch {
      // Circles unavailable — keep profile API values
    }

    return {
      trainerId: String(trainerId),
      trainerName: trainer.name || trainerId,
      totalFans,
      monthlyFans,
      dailyGain,
      weeklyGain,
      gain3d: rolling.gain_3d ?? null,
      gain7d: rolling.gain_7d ?? null,
      gain30d: rolling.gain_30d ?? null,
      monthlyRank,
      rank3d: rolling.rank_3d ?? null,
      rank7d: rolling.rank_7d ?? null,
      rank30d: rolling.rank_30d ?? null,
      activeDays,
      avgDaily,
      avg3d: monthly.avg_3d ?? null,
      avg7d: monthly.avg_7d ?? null,
      clubRankTier: tier,
      previousCircleName,
      updatedAt: new Date().toISOString(),
      isActive: true,
    };
  }

  private mapCircleMemberToStats(m: any, circle: any): TrainerStats {
    const circleTierFromFans = (fans: number): string => {
      if (fans >= 2_000_000) return 'S-Class';
      if (fans >= 1_000_000) return 'A-Class';
      if (fans >= 500_000) return 'B-Class';
      return 'C-Class';
    };
    const trainerId = String(m.viewer_id);
    const dailyFans: number[] = m.daily_fans || [];
    let lastIdx = dailyFans.length - 1;
    while (lastIdx >= 0 && dailyFans[lastIdx] === 0) lastIdx--;
    const isActive = lastIdx >= 0 && dailyFans[lastIdx] > 0;
    const totalFans = isActive ? dailyFans[lastIdx] : (dailyFans.find((f: number) => f > 0) || 0);
    const now = new Date();
    const dayOfMonth = now.getDate();
    const monthStartIdx = Math.max(0, lastIdx - dayOfMonth + 1);
    const baselineFans = dailyFans[monthStartIdx] > 0 ? dailyFans[monthStartIdx]
      : (() => { for (let i = monthStartIdx; i <= lastIdx; i++) { if (dailyFans[i] > 0) return dailyFans[i]; } return totalFans; })();
    const monthlyFans = totalFans > 0 ? totalFans - baselineFans : 0;
    const dailyGain = lastIdx >= 1 && dailyFans[lastIdx - 1] > 0 ? dailyFans[lastIdx] - dailyFans[lastIdx - 1] : 0;
    const weeklyStartIdx = Math.max(monthStartIdx, lastIdx - 6);
    const weeklyGain = weeklyStartIdx < lastIdx && dailyFans[weeklyStartIdx] > 0 ? dailyFans[lastIdx] - dailyFans[weeklyStartIdx] : 0;
    const activeDays = Math.max(0, lastIdx - monthStartIdx + 1);
    const previousCircleName = m.previous_circle_name || null;
    return {
      trainerId, trainerName: m.trainer_name || trainerId, totalFans, monthlyFans, dailyGain, weeklyGain,
      gain3d: null, gain7d: null, gain30d: null,
      monthlyRank: circle?.monthly_rank ?? null, rank3d: null, rank7d: null, rank30d: null,
      activeDays, avgDaily: activeDays > 0 ? Math.round(monthlyFans / activeDays) : null,
      avg3d: null, avg7d: null, clubRankTier: circleTierFromFans(totalFans),
      previousCircleName, updatedAt: m.last_updated || new Date().toISOString(), isActive,
    };
  }

  private generateMockStats(trainerId: string): TrainerStats {
    const roster = this.getMockRoster();
    const entry = roster.find(t => t.trainerId === trainerId);
    const name = entry?.trainerName ? `[MOCK] ${entry.trainerName}` : `[MOCK] Trainer #${trainerId}`;
    const tier = entry?.tier || 'B-Class';
    const seed = trainerId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const baseFans = 500_000 + (seed % 1_500_000);
    const gainPerDay = 500 + (seed % 8_000);
    return { trainerId, trainerName: name, totalFans: baseFans, monthlyFans: gainPerDay * 29, dailyGain: gainPerDay, weeklyGain: gainPerDay * 7, gain3d: gainPerDay * 3, gain7d: gainPerDay * 7, gain30d: gainPerDay * 30, monthlyRank: null, rank3d: null, rank7d: null, rank30d: null, activeDays: 29, avgDaily: gainPerDay, avg3d: gainPerDay * 3, avg7d: gainPerDay * 7, clubRankTier: tier, previousCircleName: null, updatedAt: new Date().toISOString(), isActive: true };
  }

  private generateMockTrends(trainerId: string, period: string): TrendAnalysis {
    const stats = this.generateMockStats(trainerId);
    const days = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;
    const gain = stats.dailyGain * days;
    const historicalFans: Array<{ date: string; count: number }> = [];
    const base = stats.totalFans - gain;
    for (let d = 0; d <= days; d++) {
      historicalFans.push({ date: new Date(Date.now() - (days - d) * 86400000).toISOString().slice(0, 10), count: base + Math.round(gain * (d / days)) });
    }
    return { trainerId, period, gain, rank: null, avgFansPerDay: stats.dailyGain, growthVelocity: `${((gain / stats.totalFans) * 100).toFixed(1)}% ${period === 'monthly' ? 'monthly' : period === 'weekly' ? 'weekly' : 'daily'}`, historicalFans };
  }

  private getMockRoster(): Array<{ trainerId: string; trainerName: string; tier: string }> {
    return [
      { trainerId: 'trainer-01', trainerName: 'Silence Suzuka', tier: 'SS-Class' },
      { trainerId: 'trainer-02', trainerName: 'Tokai Teio', tier: 'SS-Class' },
      { trainerId: 'trainer-03', trainerName: 'Special Week', tier: 'S-Class' },
      { trainerId: 'trainer-04', trainerName: 'El Condor Pasa', tier: 'S-Class' },
      { trainerId: 'trainer-05', trainerName: 'Grass Wonder', tier: 'A-Class' },
      { trainerId: 'trainer-06', trainerName: 'Mejiro McQueen', tier: 'A-Class' },
      { trainerId: 'trainer-07', trainerName: 'Oguri Cap', tier: 'A-Class' },
      { trainerId: 'trainer-08', trainerName: 'Symboli Rudolf', tier: 'B-Class' },
      { trainerId: 'trainer-09', trainerName: 'Narita Brian', tier: 'B-Class' },
      { trainerId: 'trainer-10', trainerName: 'T M Opera O', tier: 'B-Class' },
      { trainerId: 'trainer-11', trainerName: 'Maruzensky', tier: 'C-Class' },
      { trainerId: 'trainer-12', trainerName: 'Fuji Kiseki', tier: 'C-Class' },
    ];
  }
}

export const fanTrackerAPI = new FanTrackerAPI();