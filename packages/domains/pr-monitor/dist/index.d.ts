import type { ToolDefinition } from '@ai-agent-platform/shared';
export interface PullRequest {
    id: string;
    number: number;
    title: string;
    state: 'open' | 'closed' | 'merged';
    author: string;
    repo: string;
    branch: string;
    baseBranch: string;
    createdAt: string;
    updatedAt: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    labels: string[];
    reviewers: string[];
    url: string;
}
export interface PRSummary {
    repo: string;
    totalOpen: number;
    totalMerged?: number;
    totalClosed?: number;
    avgTimeToMerge?: string;
    topContributors: Array<{
        author: string;
        count: number;
    }>;
    stalePRs: PullRequest[];
    recentActivity: PullRequest[];
}
export interface ReviewRequest {
    prId: string;
    prNumber: number;
    title: string;
    author: string;
    repo: string;
    requestedAt: string;
    url: string;
}
export declare class PRMonitorAPI {
    private baseUrl;
    private token?;
    constructor(baseUrl?: string, token?: string);
    /**
     * Fetch open PRs for a repository.
     */
    fetchOpenPRs(repo: string): Promise<PullRequest[]>;
    /**
     * Fetch review requests for the authenticated user.
     */
    fetchMyReviewRequests(): Promise<ReviewRequest[]>;
    /**
     * Generate a summary of PR activity for a repo.
     */
    generateSummary(repo: string): Promise<PRSummary>;
    /**
     * Clear the domain cache.
     */
    clearCache(): void;
    getCacheStats(): import("@ai-agent-platform/core").CacheStats;
    private mockPRs;
    private mockReviewRequests;
}
export declare const prMonitorFetchPRs: ToolDefinition;
export declare const prMonitorReviewRequests: ToolDefinition;
export declare const prMonitorSummary: ToolDefinition;
export declare const allDomainTools: ToolDefinition[];
export declare const prMonitorAPI: PRMonitorAPI;
//# sourceMappingURL=index.d.ts.map