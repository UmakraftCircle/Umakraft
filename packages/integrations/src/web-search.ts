import { createLogger } from '@ai-agent-platform/shared';
import { getTursoClient } from './turso.js';

const logger = createLogger('WebSearch');

/**
 * Feature 3: AnySearch web research + Turso result cache.
 *
 * - AnySearch endpoint: POST https://api.anysearch.com/v1/search
 * - Auth:  Authorization: Bearer ${ANYSEARCH_API_KEY} (optional; anonymous is rate-limited)
 * - Body:  { query, max_results (1-20), tag?, ... }
 * - Result: { code, data: { results: [{ title, url, snippet, content }], metadata } }
 */

const ANYSEARCH_BASE_URL = 'https://api.anysearch.com';
const ANYSEARCH_ENDPOINT = `${ANYSEARCH_BASE_URL}/v1/search`;
const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS = 20;
const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TIME_SENSITIVE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

/** Queries about current/latest things should be treated as time-sensitive. */
const TIME_SENSITIVE_PATTERNS = [
  /latest\b/i, /newest\b/i, /current\b/i, /today\b/i, /now\b/i,
  /news\b/i, /banner\b/i, /event\b/i, /announcement\b/i, /upcoming\b/i,
  /\bbanner\b/i, /\bnotice\b/i, /recent\b/i, /this week\b/i, /this month\b/i,
];

interface Rm {
  title: string;
  url: string;
  snippet: string;
  content: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content: string;
  source: string; // host extracted from url
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTimeMs: number;
  fromCache: boolean;
  retrievedAt: string;
  cacheExpiresAt: string | null;
}

/** Simple token-bucket rate limiter (mirrors the fan-tracker convention). */
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
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

const limiter = new RateLimiter(1);

function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isTimeSensitive(query: string): boolean {
  return TIME_SENSITIVE_PATTERNS.some((p) => p.test(query));
}

/** Extract a safe host (lowercased, no scheme/path) for source attribution. */
function sourceHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
}

/** Reject clearly malformed / unsafe URLs (non-http(s), javascript:, etc.). */
function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (!u.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeResult(r: Rm): SearchResult | null {
  if (!r || !isSafeUrl(r.url || '')) return null;
  return {
    title: String(r.title || '').slice(0, 300),
    url: r.url,
    snippet: String(r.snippet || ''),
    content: String(r.content || ''),
    source: sourceHost(r.url),
  };
}

interface WebSearchCacheStore {
  get(query: string): Promise<SearchResponse | null>;
  set(query: string, response: SearchResponse): Promise<void>;
}

/** Turso-backed cache (per Feature 3 spec). */
class TursoWebSearchCache implements WebSearchCacheStore {
  private tableReady = false;
  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS web_search_cache (
        normalized_query TEXT PRIMARY KEY,
        result_metadata  TEXT NOT NULL,
        source_urls      TEXT NOT NULL,
        results_json     TEXT NOT NULL,
        retrieved_at     TEXT NOT NULL,
        expiration_time  TEXT NOT NULL
      )
    `);
    this.tableReady = true;
    logger.info('web_search_cache table ready');
  }
  async get(normalizedQuery: string): Promise<SearchResponse | null> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT results_json, retrieved_at, expiration_time FROM web_search_cache WHERE normalized_query = ?',
      args: [normalizedQuery],
    });
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const expiresAt = row['expiration_time'] as string;
    if (new Date(expiresAt).getTime() <= Date.now()) {
      // expired — treat as miss
      return null;
    }
    try {
      const cached = JSON.parse(row['results_json'] as string) as SearchResponse;
      cached.fromCache = true;
      return cached;
    } catch {
      return null;
    }
  }
  async set(normalizedQuery: string, response: SearchResponse): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const expiresAt = response.cacheExpiresAt || new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await db.execute({
      sql: `INSERT INTO web_search_cache (normalized_query, result_metadata, source_urls, results_json, retrieved_at, expiration_time)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(normalized_query) DO UPDATE SET
              result_metadata = excluded.result_metadata,
              source_urls = excluded.source_urls,
              results_json = excluded.results_json,
              retrieved_at = excluded.retrieved_at,
              expiration_time = excluded.expiration_time`,
      args: [
        normalizedQuery,
        JSON.stringify({ totalResults: response.totalResults, searchTimeMs: response.searchTimeMs }),
        JSON.stringify(response.results.map((r) => r.url)),
        JSON.stringify(response),
        response.retrievedAt,
        expiresAt,
      ],
    });
  }
}

const cache = new TursoWebSearchCache();

export class AnySearchClient {
  private apiKey: string;
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['ANYSEARCH_API_KEY'] || '';
  }

  /**
   * Search the web. Returns normalized results, served from cache when fresh.
   * Time-sensitive queries use a short TTL and bypass stale cache.
   */
  async search(query: string, options: { maxResults?: number; bypassCache?: boolean; tag?: string } = {}): Promise<SearchResponse> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { results: [], totalResults: 0, searchTimeMs: 0, fromCache: false, retrievedAt: new Date().toISOString(), cacheExpiresAt: null };
    }

    const normalized = normalizeQuery(cleanQuery);
    const timeSensitive = isTimeSensitive(cleanQuery);
    const maxResults = Math.min(Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS), MAX_RESULTS);

    // Cache read (skip for time-sensitive queries so we always get fresh data).
    if (!options.bypassCache && !timeSensitive) {
      const cached = await cache.get(normalized);
      if (cached) {
        logger.info(`Web search cache hit for "${cleanQuery.slice(0, 60)}"`);
        return cached;
      }
    }

    await limiter.acquire();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const body: Record<string, any> = { query: cleanQuery, max_results: maxResults };
    if (options.tag) body['tag'] = options.tag;

    let data: any;
    try {
      const res = await fetch(ANYSEARCH_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`AnySearch ${res.status}: ${text.slice(0, 200)}`);
      }

      data = await res.json();
      if (data?.code !== 0) {
        throw new Error(`AnySearch error code ${data?.code}: ${data?.message || 'unknown'}`);
      }
    } catch (err: any) {
      logger.error(`AnySearch request failed for "${cleanQuery.slice(0, 60)}": ${err?.message || err}`);
      // Graceful failure: return empty results rather than throwing.
      return { results: [], totalResults: 0, searchTimeMs: 0, fromCache: false, retrievedAt: new Date().toISOString(), cacheExpiresAt: null };
    }

    const rawResults: Rm[] = data?.data?.results || [];
    const metadata = data?.data?.metadata || {};
    const results = rawResults
      .map(normalizeResult)
      .filter((r): r is SearchResult => r !== null);

    const cacheTtl = timeSensitive ? TIME_SENSITIVE_CACHE_TTL_MS : CACHE_TTL_MS;
    const response: SearchResponse = {
      results,
      totalResults: metadata.total_results ?? results.length,
      searchTimeMs: metadata.search_time_ms ?? 0,
      fromCache: false,
      retrievedAt: new Date().toISOString(),
      cacheExpiresAt: new Date(Date.now() + cacheTtl).toISOString(),
    };

    // Persist to Turso cache (best-effort).
    try {
      await cache.set(normalized, response);
    } catch (err: any) {
      logger.warn(`Failed to cache web search result: ${err?.message || err}`);
    }

    return response;
  }
}

export const anySearchClient = new AnySearchClient();

export const searchWebTool = {
  slug: 'search_web',
  name: 'Search Web',
  description: 'Search the web for current/external information (Uma Musume news, banners, events, announcements). Returns title, url, snippet and source for each result.',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
    maxResults: { type: 'number', description: 'Max results (1-20, default 10)', required: false },
  },
  handler: async (args: Record<string, any>) => {
    const query = String(args['query'] || '');
    const maxResults = args['maxResults'] === undefined ? undefined : Number(args['maxResults']);
    const response = await anySearchClient.search(query, { maxResults });
    return {
      query,
      totalResults: response.totalResults,
      searchTimeMs: response.searchTimeMs,
      fromCache: response.fromCache,
      retrievedAt: response.retrievedAt,
      results: response.results.map((r) => ({
        title: r.title,
        url: r.url,
        source: r.source,
        snippet: r.snippet,
      })),
    };
  },
};

export { normalizeQuery, isTimeSensitive, isSafeUrl };
