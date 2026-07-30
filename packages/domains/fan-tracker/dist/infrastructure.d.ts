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
    historicalFans: Array<{
        date: string;
        count: number;
    }>;
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
export declare class FanTrackerAPI {
    private circleId;
    private apiKey;
    private baseUrl;
    private limiter;
    constructor(circleId?: string, apiKey?: string);
    private apiGet;
    fetchTrainerStats(trainerId: string): Promise<TrainerStats>;
    /**
     * Fallback: extract trainer stats from the circles endpoint when profile API fails.
     */
    private fetchTrainerStatsFromCircle;
    fetchAllMembers(): Promise<TrainerStats[]>;
    listAllTrainers(): Promise<Array<{
        trainerId: string;
        trainerName: string;
        tier: string;
    }>>;
    analyzeTrends(trainerId: string, period?: string): Promise<TrendAnalysis>;
    fetchRankThresholds(): Promise<RankThreshold[]>;
    getTierForRank(rank: number | null): Promise<string>;
    clearCache(): void;
    getCacheStats(): import("@ai-agent-platform/core").CacheStats;
    private mapProfileToStats;
    private mapCircleMemberToStats;
    private generateMockStats;
    private generateMockTrends;
    private getMockRoster;
}
export declare const fanTrackerAPI: FanTrackerAPI;
//# sourceMappingURL=infrastructure.d.ts.map