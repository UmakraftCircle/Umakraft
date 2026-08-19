import { createLogger } from '@ai-agent-platform/shared';
import { getTursoClient } from './turso.js';

const logger = createLogger('WebSearch');

/**
 * Feature 3: Tavily web research + Turso result cache.
 *
 * - Tavily endpoint: POST https://api.tavily.com/search
 * - Auth: Authorization: Bearer ${TAVILY_API_KEY}
 * - Body: { query, max_results (1-20), ... }
 * - Result: { results: [{ title, url, content }], ... }
 *
 * Supports multiple keys via a single comma-separated TAVILY_API_KEY env var
 * (e.g. "key1,key2,key3"). Requests rotate/fall back across the key pool on
 * failure (401/403/429, network error) so one dead or rate-limited key does
 * not break search.
 */

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS = 20;
const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TIME_SENSITIVE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

/** Queries about current/latest things should be treated as time-sensitive. */
const TIME_SENSITIVE_PATTERNS = [
  /latest\b/i, /newest\b/i, /current\b/i, /today\b/i, /now\b/i,
  /news\b/i, /banner\b/i, /event\b/i, /announcement\b/i, /upcoming\b/i,
  /\bnotice\b/i, /recent\b/i, /this week\b/i, /this month\b/i,
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

/**
 * Read the comma-separated TAVILY_API_KEY env var into a deduped, trimmed pool.
 * Tolerant to stray whitespace/newlines around commas.
 */
function readTavilyKeys(): string[] {
  const raw = process.env['TAVILY_API_KEY'] || '';
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const part of raw.split(',')) {
    const key = part.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
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

/** Raw shape of a single Tavily result (kept minimal; only mapped fields are used). */
interface TavilyRawResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyRawResponse {
  results?: TavilyRawResult[];
  response_time?: number;
}

export class TavilyClient {
  private apiKeys: string[];
  constructor(apiKeys?: string[]) {
    this.apiKeys = apiKeys && apiKeys.length ? apiKeys : readTavilyKeys();
  }

  /**
   * Search the web. Returns normalized results, served from cache when fresh.
   * Time-sensitive queries use a short TTL and bypass stale cache.
   *
   * On failure, rotates through the available API keys (falling back on 401/403/429
   * or a network error) so a single dead or rate-limited key does not break search.
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

    if (this.apiKeys.length === 0) {
      logger.error('Tavily search skipped: TAVILY_API_KEY is not set (provide a comma-separated list of keys).');
      return { results: [], totalResults: 0, searchTimeMs: 0, fromCache: false, retrievedAt: new Date().toISOString(), cacheExpiresAt: null };
    }

    const body: Record<string, any> = { query: cleanQuery, max_results: maxResults };
    if (options.tag) body['tag'] = options.tag;

    let data: TavilyRawResponse | null = null;
    let lastError: any = null;

    for (const apiKey of this.apiKeys) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      try {
        const res = await fetch(TAVILY_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const msg = `Tavily ${res.status}: ${text.slice(0, 200)}`;
          lastError = new Error(msg);
          // Retryable auth/rate-limit errors → advance to next key.
          if (res.status === 401 || res.status === 403 || res.status === 429) {
            logger.warn(`Tavily key failed (${res.status}), rotating to next key`);
            continue;
          }
          throw lastError;
        }

        data = (await res.json()) as TavilyRawResponse;
        break;
      } catch (err: any) {
        lastError = err;
        logger.warn(`Tavily request failed for "${cleanQuery.slice(0, 60)}" (key rotating): ${err?.message || err}`);
        // Network timeout / transport error → advance to next key.
        continue;
      }
    }

    if (!data) {
      logger.error(`All Tavily keys failed for "${cleanQuery.slice(0, 60)}": ${lastError?.message || 'unknown error'}`);
      // Graceful failure: return empty results rather than throwing.
      return { results: [], totalResults: 0, searchTimeMs: 0, fromCache: false, retrievedAt: new Date().toISOString(), cacheExpiresAt: null };
    }

    const rawResults: Rm[] = (data.results || []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
      content: r.content ?? '',
    }));

    const results = rawResults
      .map(normalizeResult)
      .filter((r): r is SearchResult => r !== null);

    const cacheTtl = timeSensitive ? TIME_SENSITIVE_CACHE_TTL_MS : CACHE_TTL_MS;
    const response: SearchResponse = {
      results,
      totalResults: results.length,
      searchTimeMs: data.response_time ?? 0,
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

export const tavilyClient = new TavilyClient();

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
    const response = await tavilyClient.search(query, { maxResults });
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
