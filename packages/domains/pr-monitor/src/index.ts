/**
 * GitHub PR Monitor Domain
 * 
 * Second benchmark domain proving the platform is domain-agnostic.
 * Follows the same architecture as fan-tracker: API client + TTL cache + mock fallback.
 */
import { createLogger } from '@ai-agent-platform/shared';
import { CacheStore } from '@ai-agent-platform/core';
import type { ToolDefinition } from '@ai-agent-platform/shared';

const logger = createLogger('PR-Monitor');
const cache = new CacheStore({ namespace: 'pr-monitor', defaultTTL: 2 * 60 * 1000 }); // 2 min TTL

// ── Domain types ──

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
  totalMerged: number;
  totalClosed: number;
  avgTimeToMerge: string;
  topContributors: Array<{ author: string; count: number }>;
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

// ── API Client ──

export class PRMonitorAPI {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = baseUrl || process.env['GITHUB_API_URL'] || 'https://api.github.com';
    this.token = token || process.env['GITHUB_TOKEN'];
  }

  /**
   * Fetch open PRs for a repository.
   */
  public async fetchOpenPRs(repo: string): Promise<PullRequest[]> {
    const cacheKey = `open-prs:${repo}`;
    const cached = cache.get<PullRequest[]>(cacheKey);
    if (cached) return cached;

    logger.info(`Fetching open PRs for ${repo}...`);

    try {
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

      const response = await fetch(
        `${this.baseUrl}/repos/${repo}/pulls?state=open&per_page=30`,
        { headers, signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const prs: PullRequest[] = data.map((pr: any) => ({
        id: String(pr.id),
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login || 'unknown',
        repo,
        branch: pr.head?.ref || 'unknown',
        baseBranch: pr.base?.ref || 'unknown',
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changedFiles: pr.changed_files || 0,
        labels: (pr.labels || []).map((l: any) => l.name),
        reviewers: (pr.requested_reviewers || []).map((r: any) => r.login),
        url: pr.html_url,
      }));

      cache.set(cacheKey, prs);
      logger.info(`Fetched ${prs.length} open PRs for ${repo}.`);
      return prs;
    } catch (error: any) {
      logger.error(`Failed to fetch PRs for ${repo}: ${error.message}`);
      return this.mockPRs(repo);
    }
  }

  /**
   * Fetch review requests for the authenticated user.
   */
  public async fetchMyReviewRequests(): Promise<ReviewRequest[]> {
    const cacheKey = 'my-review-requests';
    const cached = cache.get<ReviewRequest[]>(cacheKey);
    if (cached) return cached;

    logger.info('Fetching my review requests...');

    try {
      if (!this.token) throw new Error('No GitHub token configured');

      const response = await fetch(
        `${this.baseUrl}/issues?filter=all&state=open&labels=needs-review`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.token}`,
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const data = await response.json();
      const requests: ReviewRequest[] = (data || [])
        .filter((issue: any) => issue.pull_request)
        .map((pr: any) => ({
          prId: String(pr.id),
          prNumber: pr.number,
          title: pr.title,
          author: pr.user?.login || 'unknown',
          repo: pr.repository_url?.split('/repos/')[1] || 'unknown',
          requestedAt: pr.updated_at,
          url: pr.html_url,
        }));

      cache.set(cacheKey, requests);
      return requests;
    } catch (error: any) {
      logger.error(`Failed to fetch review requests: ${error.message}`);
      return this.mockReviewRequests();
    }
  }

  /**
   * Generate a summary of PR activity for a repo.
   */
  public async generateSummary(repo: string): Promise<PRSummary> {
    const cacheKey = `summary:${repo}`;
    const cached = cache.get<PRSummary>(cacheKey);
    if (cached) return cached;

    logger.info(`Generating PR summary for ${repo}...`);

    const openPRs = await this.fetchOpenPRs(repo);

    // Compute stats
    const now = Date.now();
    const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    const stalePRs = openPRs.filter(pr => now - new Date(pr.updatedAt).getTime() > staleThreshold);

    const authorCounts: Record<string, number> = {};
    for (const pr of openPRs) {
      authorCounts[pr.author] = (authorCounts[pr.author] || 0) + 1;
    }

    const topContributors = Object.entries(authorCounts)
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const summary: PRSummary = {
      repo,
      totalOpen: openPRs.length,
      totalMerged: 0,   // would need closed PRs endpoint
      totalClosed: 0,
      avgTimeToMerge: 'N/A',
      topContributors,
      stalePRs,
      recentActivity: openPRs.slice(0, 10),
    };

    cache.set(cacheKey, summary, 5 * 60 * 1000); // 5 min TTL for summaries
    return summary;
  }

  /**
   * Clear the domain cache.
   */
  public clearCache(): void {
    cache.clear();
  }

  public getCacheStats() {
    return cache.getStats();
  }

  // ── Mock fallbacks ──

  private mockPRs(repo: string): PullRequest[] {
    return [
      {
        id: 'mock-1', number: 142, title: 'Add rate limiting middleware',
        state: 'open', author: 'alice-dev', repo, branch: 'feat/rate-limit',
        baseBranch: 'main', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
        additions: 245, deletions: 32, changedFiles: 8,
        labels: ['enhancement', 'security'], reviewers: ['bob-reviewer'],
        url: `https://github.com/${repo}/pull/142`,
      },
      {
        id: 'mock-2', number: 141, title: 'Fix: memory leak in task scheduler',
        state: 'open', author: 'charlie-eng', repo, branch: 'fix/memory-leak',
        baseBranch: 'main', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        additions: 18, deletions: 64, changedFiles: 3,
        labels: ['bug', 'critical'], reviewers: [],
        url: `https://github.com/${repo}/pull/141`,
      },
      {
        id: 'mock-3', number: 140, title: 'Update README with deployment guide',
        state: 'open', author: 'diana-docs', repo, branch: 'docs/deploy-guide',
        baseBranch: 'main', createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        additions: 120, deletions: 15, changedFiles: 1,
        labels: ['documentation'], reviewers: ['alice-dev', 'bob-reviewer'],
        url: `https://github.com/${repo}/pull/140`,
      },
    ];
  }

  private mockReviewRequests(): ReviewRequest[] {
    return [
      {
        prId: 'mock-1', prNumber: 142,
        title: 'Add rate limiting middleware',
        author: 'alice-dev', repo: 'ai-agent-platform',
        requestedAt: new Date().toISOString(),
        url: 'https://github.com/ai-agent-platform/pull/142',
      },
    ];
  }
}

// ── Domain tools ──

const api = new PRMonitorAPI();

export const prMonitorFetchPRs: ToolDefinition = {
  slug: 'pr-monitor-fetch-prs',
  name: 'PR Monitor: Fetch Open PRs',
  description: 'Fetches open pull requests for a GitHub repository.',
  parameters: {
    repo: {
      type: 'string',
      description: 'GitHub repo in owner/name format (e.g. "facebook/react")',
      required: true,
    },
  },
  handler: async (args) => {
    const repo = args['repo'];
    if (!repo) throw new Error('repo parameter is required');

    const prs = await api.fetchOpenPRs(repo);
    return { repo, count: prs.length, pullRequests: prs };
  },
};

export const prMonitorReviewRequests: ToolDefinition = {
  slug: 'pr-monitor-review-requests',
  name: 'PR Monitor: My Review Requests',
  description: 'Fetches PRs awaiting your review.',
  parameters: {},
  handler: async () => {
    const requests = await api.fetchMyReviewRequests();
    return { count: requests.length, reviewRequests: requests };
  },
};

export const prMonitorSummary: ToolDefinition = {
  slug: 'pr-monitor-summary',
  name: 'PR Monitor: Generate Summary',
  description: 'Generates a summary of PR activity for a repository.',
  parameters: {
    repo: {
      type: 'string',
      description: 'GitHub repo in owner/name format',
      required: true,
    },
  },
  handler: async (args) => {
    const repo = args['repo'];
    if (!repo) throw new Error('repo parameter is required');

    const summary = await api.generateSummary(repo);
    return summary;
  },
};

export const allDomainTools = [prMonitorFetchPRs, prMonitorReviewRequests, prMonitorSummary];

// Singleton
export const prMonitorAPI = api;
