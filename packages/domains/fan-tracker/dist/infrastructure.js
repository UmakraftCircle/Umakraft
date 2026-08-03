import { createLogger } from '@ai-agent-platform/shared';
import { CacheStore } from '@ai-agent-platform/core';
const logger = createLogger('FanTrackerInfra');
// ── Rate Limiter (token bucket, 1 req/sec) ──
class RateLimiter {
    tokens;
    lastRefill;
    maxTokens;
    refillRate; // tokens per ms
    constructor(maxReqsPerSec = 1) {
        this.maxTokens = maxReqsPerSec;
        this.tokens = maxReqsPerSec;
        this.lastRefill = Date.now();
        this.refillRate = maxReqsPerSec / 1000;
    }
    async acquire() {
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
// ── API Client ──
export class FanTrackerAPI {
    circleId;
    apiKey;
    baseUrl;
    limiter;
    constructor(circleId, apiKey) {
        this.circleId = circleId || process.env['UMAMOE_CIRCLE_ID'] || '974470619';
        this.apiKey = apiKey || process.env['UMAMOE_API_KEY'] || '';
        this.baseUrl = 'https://uma.moe';
        this.limiter = new RateLimiter(1);
    }
    // ────────────────────────────────────────────────────────────────
    // Core: fetch circle with all members
    // ────────────────────────────────────────────────────────────────
    async apiGet(path, cacheKey, ttl) {
        if (cacheKey) {
            const cached = cache.get(cacheKey);
            if (cached)
                return cached;
        }
        await this.limiter.acquire();
        const headers = { 'Accept-Encoding': 'gzip, deflate' };
        if (this.apiKey)
            headers['X-API-Key'] = this.apiKey;
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
        const data = await res.json();
        if (cacheKey)
            cache.set(cacheKey, data, ttl || 5 * 60 * 1000);
        return data;
    }
    // ────────────────────────────────────────────────────────────────
    // fetchTrainerStats: uses profile endpoint for rich data
    // ────────────────────────────────────────────────────────────────
    async fetchTrainerStats(trainerId) {
        const cacheKey = `trainer-profile:${trainerId}`;
        try {
            const profile = await this.apiGet(`/api/v4/user/profile/${trainerId}`, cacheKey, 5 * 60 * 1000);
            return this.mapProfileToStats(trainerId, profile);
        }
        catch (error) {
            logger.warn(`Profile fetch failed for ${trainerId}: ${error.message}. Falling back to circles data.`);
            return this.fetchTrainerStatsFromCircle(trainerId);
        }
    }
    /**
     * Fallback: extract trainer stats from the circles endpoint when profile API fails.
     */
    async fetchTrainerStatsFromCircle(trainerId) {
        const members = await this.fetchAllMembers();
        const member = members.find(m => m.trainerId === trainerId);
        if (member)
            return member;
        // Last resort: mock
        logger.warn(`Trainer ${trainerId} not found in circle. Using mock.`);
        return this.generateMockStats(trainerId);
    }
    // ────────────────────────────────────────────────────────────────
    // fetchAllMembers: get all members with computed stats (leaderboard)
    // ────────────────────────────────────────────────────────────────
    async fetchAllMembers() {
        const cacheKey = `circle-members:${this.circleId}`;
        try {
            const data = await this.apiGet(`/api/v4/circles?circle_id=${this.circleId}`, cacheKey, 10 * 60 * 1000);
            const members = data.members || [];
            // Diagnostic: log raw member fields to discover API response shape
            // (e.g., is there a 'status' or 'is_member' field we're not using?)
            if (members.length > 0) {
                logger.info(`fetchAllMembers: got ${members.length} circle members. ` +
                    `First member fields: ${Object.keys(members[0]).sort().join(', ')}`);
            }
            const statsList = [];
            for (const m of members) {
                const stats = this.mapCircleMemberToStats(m, data.circle);
                if (stats.isActive) {
                    statsList.push(stats);
                }
            }
            return statsList;
        }
        catch (error) {
            logger.error(`Circle fetch failed: ${error.message}. Using mock roster.`);
            return this.getMockRoster().map(t => this.generateMockStats(t.trainerId));
        }
    }
    // ────────────────────────────────────────────────────────────────
    // listAllTrainers: lightweight name+ID list (autocomplete)
    // ────────────────────────────────────────────────────────────────
    async listAllTrainers() {
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
    async analyzeTrends(trainerId, period = 'weekly') {
        const cacheKey = `trend:${trainerId}:${period}`;
        try {
            const profile = await this.apiGet(`/api/v4/user/profile/${trainerId}`, cacheKey, 5 * 60 * 1000);
            const fanHistory = profile.fan_history || {};
            const rolling = fanHistory.rolling || {};
            const monthly = (fanHistory.monthly || [])[0] || {};
            const gainMap = {
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
        }
        catch (error) {
            logger.warn(`Trend analysis failed for ${trainerId}: ${error.message}`);
            return this.generateMockTrends(trainerId, period);
        }
    }
    // ────────────────────────────────────────────────────────────────
    // fetchRankThresholds: D through SS tier boundaries
    // ────────────────────────────────────────────────────────────────
    async fetchRankThresholds() {
        try {
            const data = await this.apiGet('/api/v4/circles/rank-thresholds', 'rank-thresholds', 30 * 60 * 1000);
            return data.thresholds || [];
        }
        catch (error) {
            logger.warn(`Rank thresholds fetch failed: ${error.message}`);
            return [];
        }
    }
    async getTierForRank(rank) {
        if (rank === null || rank === undefined)
            return '?';
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
    clearCache() {
        cache.clear();
        logger.info('Fan tracker cache cleared.');
    }
    getCacheStats() {
        return cache.getStats();
    }
    // ────────────────────────────────────────────────────────────────
    // Mappers: API response → TrainerStats
    // ────────────────────────────────────────────────────────────────
    async mapProfileToStats(trainerId, profile) {
        const trainer = profile.trainer || {};
        const circle = profile.circle || {};
        const fanHistory = profile.fan_history || {};
        const rolling = fanHistory.rolling || {};
        const monthly = (fanHistory.monthly || [])[0] || {};
        const alltime = fanHistory.alltime || {};
        const monthlyRank = circle.monthly_rank ?? null;
        const tier = await this.getTierForRank(monthlyRank);
        return {
            trainerId: String(trainerId),
            trainerName: trainer.name || trainerId,
            totalFans: alltime.total_fans || monthly.total_fans || 0,
            monthlyFans: monthly.monthly_gain || 0,
            dailyGain: rolling.gain_3d ? Math.round(rolling.gain_3d / 3) : 0,
            weeklyGain: rolling.gain_7d || 0,
            gain3d: rolling.gain_3d ?? null,
            gain7d: rolling.gain_7d ?? null,
            gain30d: rolling.gain_30d ?? null,
            monthlyRank,
            rank3d: rolling.rank_3d ?? null,
            rank7d: rolling.rank_7d ?? null,
            rank30d: rolling.rank_30d ?? null,
            activeDays: monthly.active_days || 0,
            avgDaily: monthly.avg_daily ?? null,
            avg3d: monthly.avg_3d ?? null,
            avg7d: monthly.avg_7d ?? null,
            clubRankTier: tier,
            previousCircleName: null,
            updatedAt: new Date().toISOString(),
            isActive: true,
        };
    }
    mapCircleMemberToStats(m, circle) {
        // Helper: crude tier from total fan count (circles endpoint lacks club_rank_name)
        const circleTierFromFans = (fans) => {
            if (fans >= 2_000_000)
                return 'S-Class';
            if (fans >= 1_000_000)
                return 'A-Class';
            if (fans >= 500_000)
                return 'B-Class';
            return 'C-Class';
        };
        const trainerId = String(m.viewer_id);
        const dailyFans = m.daily_fans || [];
        // Find last non-zero index (real data ends, zeros indicate future/no-data days)
        let lastIdx = dailyFans.length - 1;
        while (lastIdx >= 0 && dailyFans[lastIdx] === 0)
            lastIdx--;
        const hasFanData = lastIdx >= 0 && dailyFans[lastIdx] > 0;
        // ── Ex-member detection ──
        // The uma.moe API returns kicked ex-members alongside active members
        // (34 members for a 30-cap circle; the 4 extras are ex-members).
        // Their data is NOT cleaned up, so we detect them via staleness signals:
        //   1. Fan count flatlined: same value for 3+ consecutive recent days
        //   2. last_updated timestamp > 2 days old (active members update daily)
        const fanFlatlined = lastIdx >= 2 &&
            dailyFans[lastIdx] === dailyFans[lastIdx - 1] &&
            dailyFans[lastIdx] === dailyFans[lastIdx - 2];
        const lastUpdatedMs = m.last_updated ? new Date(m.last_updated).getTime() : 0;
        const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
        const dataIsStale = lastUpdatedMs > 0 && (Date.now() - lastUpdatedMs > TWO_DAYS_MS);
        const isExMember = hasFanData && (fanFlatlined || dataIsStale);
        if (isExMember) {
            logger.debug(`Ex-member filtered: ${m.trainer_name || trainerId} ` +
                `(flatlined=${fanFlatlined}, stale=${dataIsStale})`);
        }
        const isActive = hasFanData && !isExMember;
        const totalFans = hasFanData ? dailyFans[lastIdx] : (dailyFans.find((f) => f > 0) || 0);
        // Find starting baseline: first positive value, or zero after negative transfers
        let startIdx = 0;
        for (let i = 0; i <= lastIdx; i++) {
            if (dailyFans[i] > 0) {
                startIdx = i;
                break;
            }
        }
        const baselineFans = dailyFans[startIdx] > 0 ? dailyFans[startIdx] : 0;
        const monthlyFans = totalFans > 0 ? totalFans - baselineFans : 0;
        // Compute gains from daily array
        const dailyGain = lastIdx >= 1 && dailyFans[lastIdx - 1] > 0
            ? dailyFans[lastIdx] - dailyFans[lastIdx - 1] : 0;
        const weeklyStartIdx = Math.max(0, lastIdx - 7);
        const weeklyGain = lastIdx >= 7 && dailyFans[weeklyStartIdx] > 0
            ? dailyFans[lastIdx] - dailyFans[weeklyStartIdx] : monthlyFans;
        const activeDays = lastIdx >= 0 ? lastIdx + 1 : 0;
        // Previous circle info (transfer detection)
        const previousCircleName = m.previous_circle_name || null;
        return {
            trainerId,
            trainerName: m.trainer_name || trainerId,
            totalFans,
            monthlyFans: Math.max(0, monthlyFans),
            dailyGain: Math.max(0, dailyGain),
            weeklyGain: Math.max(0, weeklyGain),
            gain3d: null, // not available from circles endpoint
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
            clubRankTier: circleTierFromFans(totalFans),
            previousCircleName,
            updatedAt: m.last_updated || new Date().toISOString(),
            isActive,
        };
    }
    // ────────────────────────────────────────────────────────────────
    // Mock fallbacks (used when API is completely unavailable)
    // ────────────────────────────────────────────────────────────────
    generateMockStats(trainerId) {
        const roster = this.getMockRoster();
        const entry = roster.find(t => t.trainerId === trainerId);
        const name = entry?.trainerName ? `[MOCK] ${entry.trainerName}` : `[MOCK] Trainer #${trainerId}`;
        const tier = entry?.tier || 'B-Class';
        const seed = trainerId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const baseFans = 500_000 + (seed % 1_500_000);
        const gainPerDay = 500 + (seed % 8_000);
        return {
            trainerId,
            trainerName: name,
            totalFans: baseFans,
            monthlyFans: gainPerDay * 29,
            dailyGain: gainPerDay,
            weeklyGain: gainPerDay * 7,
            gain3d: gainPerDay * 3,
            gain7d: gainPerDay * 7,
            gain30d: gainPerDay * 30,
            monthlyRank: null,
            rank3d: null,
            rank7d: null,
            rank30d: null,
            activeDays: 29,
            avgDaily: gainPerDay,
            avg3d: gainPerDay * 3,
            avg7d: gainPerDay * 7,
            clubRankTier: tier,
            previousCircleName: null,
            updatedAt: new Date().toISOString(),
            isActive: true,
        };
    }
    generateMockTrends(trainerId, period) {
        const stats = this.generateMockStats(trainerId);
        const days = period === 'monthly' ? 30 : period === 'weekly' ? 7 : 1;
        const gain = stats.dailyGain * days;
        const historicalFans = [];
        const base = stats.totalFans - gain;
        for (let d = 0; d <= days; d++) {
            historicalFans.push({
                date: new Date(Date.now() - (days - d) * 86400000).toISOString().slice(0, 10),
                count: base + Math.round(gain * (d / days)),
            });
        }
        return {
            trainerId,
            period,
            gain,
            rank: null,
            avgFansPerDay: stats.dailyGain,
            growthVelocity: `${((gain / stats.totalFans) * 100).toFixed(1)}% ${period === 'monthly' ? 'monthly' : period === 'weekly' ? 'weekly' : 'daily'}`,
            historicalFans,
        };
    }
    getMockRoster() {
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
// Singleton
export const fanTrackerAPI = new FanTrackerAPI();
//# sourceMappingURL=infrastructure.js.map
