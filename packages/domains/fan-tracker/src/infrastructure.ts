import { createLogger } from '@ai-agent-platform/shared';
import { CacheStore } from '@ai-agent-platform/core';

const logger = createLogger('FanTrackerInfra');

// ── Rate Limiter (token bucket, 1 req/sec) ──

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

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

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      // Wait before retrying
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

// ── Shared cache ──

const cache = new CacheStore({ namespace: 'fan-tracker', defaultTTL: 5 * 60 * 1000 });

// ── Domain types ──

export interface TrainerStats {
  trainerId: string;
  trainerName: string;
  // Fan counts
  totalFans: number;       // lifetime cumulative fans at latest update
  monthlyFans: number;     // fans earned this month (total - starting baseline)
  dailyGain: number;       // approximate gain in last 24h (from daily_fans)
  weeklyGain: number;      // approximate gain in last 7 days
  // Pre-computed gains from profile API (null when using circles fallback)
  gain3d: number | null;
  gain7d: number | null;
  gain30d: number | null;
  // Ranks  
  monthlyRank: number | null;
  rank3d: number | null;
  rank7d: number | null;
  rank30d: number | null;
  // Activity
  activeDays: number;
  avgDaily: number | null;
  avg3d: number | null;
  avg7d: number | null;
  // Tier (from rank thresholds)
  clubRankTier: string;
  // Previous club info
  previousCircleName: string | null;
  // Metadata
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

// ── Circle registry (name key → uma.moe circle id) ──

export type CircleKey = 'umakraft' | 'umakraft2' | 'unified';

export const CIRCLE_IDS: Record<'umakraft' | 'umakraft2', string> = {
  umakraft: '974470619',
  umakraft2: '325938032',
};

// ── API Client ──

export class FanTrackerAPI {
  private circleIds: string[];
  private apiKey: string;
  private baseUrl: string;
  private limiter: RateLimiter;

  constructor(circleId?: string | string[], apiKey?: string) {
    this.apiKey = apiKey || process.env['UMAMOE_API_KEY'] || '';
    this.baseUrl = 'https://uma.moe';
    this.limiter = new RateLimiter(1);

    let ids: string[] = [];
    if (Array.isArray(circleId)) {
      ids = circleId;
    } else if (typeof circleId === 'string' && circleId.trim()) {
      ids = circleId.split(',').map(s => s.trim());
    }

    const envIds = process.env['UMAMOE_CIRCLE_IDS'] || process.env['UMAMOE_CIRCLE_ID'];
    if (envIds && ids.length === 0) {
      ids = envIds.split(',').map(s => s.trim());
    }

    const defaultCircles = ['974470619', '325938032'];
    if (ids.length === 0) {
      ids = defaultCircles;
    } else {
      for (const defId of defaultCircles) {
        if (!ids.includes(defId)) ids.push(defId);
      }
    }

    this.circleIds = Array.from(new Set(ids.filter(Boolean)));
  }

  public get circleId(): string {
    return this.circleIds[0] || '974470619';
  }

  // ────────────────────────────────────────────────────────────────
  // Core: fetch circle with all members
  // ────────────────────────────────────────────────────────────────

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

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`uma.moe API ${res.status} for ${path}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as T;
    if (cacheKey) cache.set(cacheKey, data, ttl || 5 * 60 * 1000);
    return data;
  }

  // ────────────────────────────────────────────────────────────────
  // fetchTrainerStats: uses profile endpoint for rich data
  // ────────────────────────────────────────────────────────────────

  public async fetchTrainerStats(trainerId: string): Promise<TrainerStats> {
    const cacheKey = `trainer-profile:${trainerId}`;

    try {
      const profile = await this.apiGet<any>(
        `/api/v4/user/profile/${trainerId}`,
        cacheKey,
        5 * 60 * 1000, // 5 min TTL
      );
      return this.mapProfileToStats(trainerId, profile);
    } catch (error: any) {
      logger.warn(`Profile fetch failed for ${trainerId}: ${error.message}. Falling back to circles data.`);
      return this.fetchTrainerStatsFromCircle(trainerId);
    }
  }

  /**
   * Fallback: extract trainer stats from the circles endpoint when profile API fails.
   */
  private async fetchTrainerStatsFromCircle(trainerId: string): Promise<TrainerStats> {
    const members = await this.fetchAllMembers();
    const member = members.find(m => m.trainerId === trainerId);

    if (member) return member;

    throw new Error(`Trainer ${trainerId} not found in circle`);
  }

  // ────────────────────────────────────────────────────────────────
  // fetchAllMembers: get all members with computed stats (leaderboard)
  // ────────────────────────────────────────────────────────────────

  public async fetchAllMembers(): Promise<TrainerStats[]> {
    const allStats: TrainerStats[] = [];

    for (const cId of this.circleIds) {
      const cacheKey = `circle-members:${cId}`;

      try {
        const data = await this.apiGet<any>(
          `/api/v4/circles?circle_id=${cId}`,
          cacheKey,
          10 * 60 * 1000, // 10 min TTL
        );

        const members = data.members || [];
        const statsList: TrainerStats[] = [];

        for (const m of members) {
          const stats = this.mapCircleMemberToStats(m, data.circle);
          if (stats.isActive) {
            statsList.push(stats);
          }
        }

        if (statsList.length === 0 && members.length > 0) {
          logger.warn(
            `fetchAllMembers (${cId}): all ${members.length} circle members filtered as inactive. ` +
            `Returning full unfiltered list as fallback to prevent empty leaderboard.`
          );
          allStats.push(...members.map((m: any) => this.mapCircleMemberToStats(m, data.circle)));
        } else {
          allStats.push(...statsList);
        }
      } catch (error: any) {
        logger.error(`Circle fetch failed for ${cId}: ${error.message}`);
      }
    }

    const trainerMap = new Map<string, TrainerStats>();
    for (const stats of allStats) {
      const existing = trainerMap.get(stats.trainerId);
      if (!existing || stats.totalFans > existing.totalFans) {
        trainerMap.set(stats.trainerId, stats);
      }
    }

    return Array.from(trainerMap.values());
  }

  // ────────────────────────────────────────────────────────────────
  // listAllTrainers: lightweight name+ID list (autocomplete)
  // ────────────────────────────────────────────────────────────────

  /**
   * Return members for a leaderboard, optionally scoped to a single circle.
   * - 'umakraft' / 'umakraft2' → only that circle's members.
   * - 'unified' (or any unknown) → deduped union of all circles.
   */
  public async fetchLeaderboard(circle: CircleKey = 'unified'): Promise<TrainerStats[]> {
    if (circle === 'unified') return this.fetchAllMembers();

    const cId = CIRCLE_IDS[circle];
    const cacheKey = `circle-members:${cId}`;

    try {
      const data = await this.apiGet<any>(
        `/api/v4/circles?circle_id=${cId}`,
        cacheKey,
        10 * 60 * 1000,
      );

      const members = data.members || [];
      const statsList: TrainerStats[] = [];

      for (const m of members) {
        const stats = this.mapCircleMemberToStats(m, data.circle);
        if (stats.isActive) statsList.push(stats);
      }

      if (statsList.length === 0 && members.length > 0) {
        logger.warn(
          `fetchLeaderboard (${circle}/${cId}): all ${members.length} members filtered as inactive; returning full list as fallback.`
        );
        return members.map((m: any) => this.mapCircleMemberToStats(m, data.circle));
      }

      return statsList;
    } catch (error: any) {
      logger.error(`fetchLeaderboard failed for ${circle}/${cId}: ${error.message}`);
      return [];
    }
  }

  public async listAllTrainers(): Promise<Array<{ trainerId: string; trainerName: string; tier: string }>> {
    const members = await this.fetchAllMembers();
    return members.map(m => ({
      trainerId: m.trainerId,
      trainerName: m.trainerName,
      tier: m.clubRankTier,
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // analyzeTrends: uses profile fan_history for gain computation
  // ────────────────────────────────────────────────────────────────

  public async analyzeTrends(trainerId: string, period: string = 'weekly'): Promise<TrendAnalysis> {
    const cacheKey = `trend:${trainerId}:${period}`;

    try {
      const profile = await this.apiGet<any>(
        `/api/v4/user/profile/${trainerId}`,
        cacheKey,
        5 * 60 * 1000,
      );

      const fanHistory = profile.fan_history || {};
      const rolling = fanHistory.rolling || {};
      const monthly = (fanHistory.monthly || [])[0] || {};

      const gainMap: Record<string, { gain: number; rank: number | null; avg: number }> = {
        daily: { gain: rolling.gain_3d || 0, rank: rolling.rank_3d ?? null, avg: monthly.avg_3d || 0 },
        weekly: { gain: rolling.gain_7d || 0, rank: rolling.rank_7d ?? null, avg: monthly.avg_7d || 0 },
        monthly: { gain: monthly.monthly_gain || 0, rank: monthly.rank ?? null, avg: monthly.avg_monthly || 0 },
      };

      const p = gainMap[period] || gainMap.weekly;
      const velocity = p.avg > 0
        ? `${(p.gain / (p.avg * (period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1)) * 100).toFixed(1)}% ${period}`
        : 'N/A';

      return {
        trainerId,
        period,
        gain: p.gain,
        rank: p.rank,
        avgFansPerDay: p.avg,
        growthVelocity: velocity,
        historicalFans: [],
      };
    } catch (error: any) {
      logger.error(`Trend analysis failed for ${trainerId}: ${error.message}`);
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // fetchRankThresholds: D through SS tier boundaries
  // ────────────────────────────────────────────────────────────────

  public async fetchRankThresholds(): Promise<RankThreshold[]> {
    try {
      const data = await this.apiGet<any>(
        '/api/v4/circles/rank-thresholds',
        'rank-thresholds',
        30 * 60 * 1000, // 30 min TTL
      );
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
      if (t.ranking_from !== null && t.ranking_to !== null &&
        rank >= t.ranking_from && rank <= t.ranking_to) {
        return t.name;
      }
    }
    return '?';
  }

  // ────────────────────────────────────────────────────────────────
  // Cache management
  // ────────────────────────────────────────────────────────────────

  public clearCache(): void {
    cache.clear();
    logger.info('Fan tracker cache cleared.');
  }

  public getCacheStats() {
    return cache.getStats();
  }

  // ────────────────────────────────────────────────────────────────
  // Mappers: API response → TrainerStats
  // ────────────────────────────────────────────────────────────────

  private async mapProfileToStats(trainerId: string, profile: any): Promise<TrainerStats> {
    const trainer = profile.trainer || {};
    const circle = profile.circle || {};
    const fanHistory = profile.fan_history || {};
    const rolling = fanHistory.rolling || {};
    const monthly = (fanHistory.monthly || [])[0] || {};
    const alltime = fanHistory.alltime || {};

    const monthlyRank = circle.monthly_rank ?? null;

    // Always merge circles data for month-aware monthly fields.
    // The profile API's monthly_gain/active_days can carry stale data
    // at month boundaries; circles daily_fans is always cumulative and
    // mapCircleMemberToStats computes correct month-aware values.
    // Profile API is only trusted for rolling gains and ranks.
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
      clubRankTier:
        monthlyFans >= 200_000_000 ? 'Legend' :
        monthlyFans >= 150_000_000 ? 'Super-Competitive' :
        monthlyFans >= 100_000_000 ? 'Competitive' :
        monthlyFans >= 75_000_000  ? 'Casual' :
        monthlyFans >= 60_000_000  ? 'Minimum' : '-',
      previousCircleName,
      updatedAt: new Date().toISOString(),
      isActive: true,
    };
  }

  private mapCircleMemberToStats(m: any, circle: any): TrainerStats {
    // Helper: Monthly achievement tier from monthly fan gain
    const circleTierFromFans = (monthlyFans: number): string => {
      if (monthlyFans >= 200_000_000) return 'Legend';
      if (monthlyFans >= 150_000_000) return 'Super-Competitive';
      if (monthlyFans >= 100_000_000) return 'Competitive';
      if (monthlyFans >= 75_000_000)  return 'Casual';
      if (monthlyFans >= 60_000_000)  return 'Minimum';
      return '-';
    };

    const trainerId = String(m.viewer_id);
    const dailyFans: number[] = m.daily_fans || [];

    // Find last non-zero index (real data ends, zeros indicate future/no-data days)
    let lastIdx = dailyFans.length - 1;
    while (lastIdx >= 0 && dailyFans[lastIdx] === 0) lastIdx--;

    const hasFanData = lastIdx >= 0 && dailyFans[lastIdx] > 0;

    // Ex-member detection: kicked members' last_updated stops updating.
    // The API returns 34 members for a 30-cap circle; the 4 extras are ex-members.
    const lastUpdatedMs = m.last_updated ? new Date(m.last_updated).getTime() : 0;
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const isExMember = hasFanData && lastUpdatedMs > 0 && (Date.now() - lastUpdatedMs > THREE_DAYS_MS);

    const isActive = hasFanData && !isExMember;
    const totalFans = hasFanData ? dailyFans[lastIdx] : (dailyFans.find((f: number) => f > 0) || 0);

    // Month-aware baseline: anchor to current month's first day.
    // Use game timezone (JST = UTC+9), not server time.
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayOfMonth = jstNow.getUTCDate();
    const monthStartIdx = Math.max(0, lastIdx - dayOfMonth + 1);

    const baselineFans = dailyFans[monthStartIdx] > 0
      ? dailyFans[monthStartIdx]
      : (() => {
          for (let i = monthStartIdx; i <= lastIdx; i++) {
            if (dailyFans[i] > 0) return dailyFans[i];
          }
          return totalFans;
        })();
    const monthlyFans = totalFans > 0 ? totalFans - baselineFans : 0;

    // Compute gains from daily array — never cross month boundary
    const dailyGain = lastIdx >= 1 && dailyFans[lastIdx - 1] > 0
      ? dailyFans[lastIdx] - dailyFans[lastIdx - 1] : 0;
    const weeklyStartIdx = Math.max(monthStartIdx, lastIdx - 6);
    const weeklyGain = weeklyStartIdx < lastIdx && dailyFans[weeklyStartIdx] > 0
      ? dailyFans[lastIdx] - dailyFans[weeklyStartIdx] : 0;

    const activeDays = Math.max(0, lastIdx - monthStartIdx + 1);

    // Previous circle info (transfer detection)
    const previousCircleName = m.previous_circle_name || null;

    return {
      trainerId,
      trainerName: m.trainer_name || trainerId,
      totalFans,
      monthlyFans,
      dailyGain,
      weeklyGain,
      gain3d: null,   // not available from circles endpoint
      gain7d: null,
      gain30d: null,
      monthlyRank: circle?.monthly_rank ?? null,
      rank3d: null,
      rank7d: null,
      rank30d: null,
      activeDays,
      avgDaily: activeDays > 0 ? Math.round(monthlyFans / activeDays) : null,
      avg3d: null,
      avg7d: null,
      clubRankTier: circleTierFromFans(monthlyFans),
      previousCircleName,
      updatedAt: m.last_updated || new Date().toISOString(),
      isActive,
    };
  }

}

// Singleton
export const fanTrackerAPI = new FanTrackerAPI();
