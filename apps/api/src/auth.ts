/**
 * Auth Middleware for the API Server
 * 
 * Token-based authentication and rate limiting for the raw HTTP server.
 * Follows the platform principle: minimal but real — no framework, just middleware.
 */
import * as http from 'http';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Auth');

// ── Types ──

export interface AuthContext {
  authenticated: boolean;
  apiKey?: string;
  clientId?: string;
}

export interface RateLimitConfig {
  windowMs: number;       // time window in milliseconds
  maxRequests: number;     // max requests per window
}

export interface MiddlewareHandler {
  (req: http.IncomingMessage, res: http.ServerResponse, ctx: AuthContext): Promise<boolean>;
  // returns true to continue, false to stop (response already sent)
}

// ── API Key Store ──

class ApiKeyStore {
  private keys: Set<string> = new Set();

  constructor() {
    // Load from environment
    const envKey = process.env['API_KEY'];
    if (envKey) {
      this.keys.add(envKey);
      logger.info('Loaded 1 API key from API_KEY environment variable.');
    }

    // Load multiple keys from comma-separated env var
    const multiKeys = process.env['API_KEYS'];
    if (multiKeys) {
      for (const key of multiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0)) {
        this.keys.add(key);
      }
      logger.info(`Loaded ${multiKeys.split(',').length} API keys from API_KEYS.`);
    }
  }

  public validate(key: string): boolean {
    return this.keys.has(key);
  }

  public addKey(key: string): void {
    this.keys.add(key);
  }

  public revokeKey(key: string): void {
    this.keys.delete(key);
  }

  public keyCount(): number {
    return this.keys.size;
  }
}

// ── Token Bucket Rate Limiter ──

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private config: Required<RateLimitConfig>;
  private refillRate: number; // tokens per millisecond

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
    };
    this.refillRate = config.maxRequests / config.windowMs;
  }

  /**
   * Attempt to consume a token. Returns true if allowed, false if rate limited.
   */
  public consume(clientId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      bucket = { tokens: this.config.maxRequests, lastRefill: now };
      this.buckets.set(clientId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const newTokens = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.config.maxRequests, bucket.tokens + newTokens);
    bucket.lastRefill = now;

    // Periodic cleanup: remove stale buckets
    if (now % 60000 < 100) this.cleanupStale(now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get remaining tokens for a client (for info/debug).
   */
  public remainingTokens(clientId: string): number {
    const bucket = this.buckets.get(clientId);
    if (!bucket) return this.config.maxRequests;
    const elapsed = Date.now() - bucket.lastRefill;
    const newTokens = elapsed * this.refillRate;
    return Math.min(this.config.maxRequests, bucket.tokens + newTokens);
  }

  /**
   * Get time until next token is available (ms).
   */
  public retryAfterMs(clientId: string): number {
    const bucket = this.buckets.get(clientId);
    if (!bucket || bucket.tokens >= 1) return 0;
    return Math.ceil((1 - bucket.tokens) / this.refillRate);
  }

  private cleanupStale(now: number): void {
    const idleThreshold = 5 * 60 * 1000; // 5 min
    for (const [clientId, bucket] of this.buckets) {
      if (now - bucket.lastRefill > idleThreshold && bucket.tokens >= this.config.maxRequests * 0.9) {
        this.buckets.delete(clientId);
      }
    }
  }
}

// ── Auth Middleware ──

export interface AuthMiddlewareConfig {
  requireAuth?: boolean;     // if true, reject unauthenticated requests
  rateLimit?: RateLimitConfig;
  publicPaths?: string[];    // paths that bypass auth (e.g. /health)
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,       // 1 minute
  maxRequests: 100,          // 100 requests per minute
};

export class AuthMiddleware {
  private keyStore: ApiKeyStore;
  private rateLimiter: RateLimiter;
  private config: Required<AuthMiddlewareConfig>;

  constructor(config: AuthMiddlewareConfig = {}) {
    this.keyStore = new ApiKeyStore();
    this.rateLimiter = new RateLimiter(config.rateLimit || DEFAULT_RATE_LIMIT);
    this.config = {
      requireAuth: config.requireAuth ?? true,
      rateLimit: config.rateLimit || DEFAULT_RATE_LIMIT,
      publicPaths: config.publicPaths ?? ['/health'],
    };
  }

  /**
   * Main middleware handler. Call this at the top of every route handler.
   * Returns AuthContext if request should proceed, or null if response was already sent.
   */
  public async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<AuthContext | null> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // ── 1. Public path bypass ──
    if (this.config.publicPaths.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
      return { authenticated: false };
    }

    // ── 2. Rate limiting ──
    const clientId = this.getClientId(req);
    if (!this.rateLimiter.consume(clientId)) {
      const retryAfter = Math.ceil(this.rateLimiter.retryAfterMs(clientId) / 1000);
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(this.config.rateLimit.maxRequests),
        'X-RateLimit-Remaining': '0',
      });
      res.end(JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      }));
      logger.warn(`Rate limit exceeded for client: ${clientId}`);
      return null;
    }

    // ── 3. Auth check ──
    const authHeader = req.headers['authorization'];
    const apiKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (url.searchParams.get('api_key') || undefined);

    if (this.config.requireAuth && this.keyStore.keyCount() > 0) {
      if (!apiKey || !this.keyStore.validate(apiKey)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Unauthorized',
          message: 'Valid API key required. Provide via Authorization: Bearer <key> header or ?api_key= query parameter.',
        }));
        logger.warn(`Authentication failed for client: ${clientId}`);
        return null;
      }
    }

    // Set rate limit headers on all responses
    res.setHeader('X-RateLimit-Limit', String(this.config.rateLimit.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.floor(this.rateLimiter.remainingTokens(clientId))));

    return {
      authenticated: !!apiKey,
      apiKey: apiKey,
      clientId,
    };
  }

  /**
   * Add an API key programmatically.
   */
  public addApiKey(key: string): void {
    this.keyStore.addKey(key);
    logger.info('API key added programmatically.');
  }

  /**
   * Revoke an API key.
   */
  public revokeApiKey(key: string): void {
    this.keyStore.revokeKey(key);
    logger.info('API key revoked.');
  }

  /**
   * Get the number of registered API keys.
   */
  public getKeyCount(): number {
    return this.keyStore.keyCount();
  }

  private getClientId(req: http.IncomingMessage): string {
    // Use API key as client ID if available, otherwise fall back to IP
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return `key:${authHeader.slice(7).slice(0, 16)}`;
    }

    // IP-based identification
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return `ip:${forwarded.split(',')[0].trim()}`;
    }

    return `ip:${req.socket.remoteAddress || 'unknown'}`;
  }
}

// ── Helper: extract API key from request ──

export function extractApiKey(req: http.IncomingMessage): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  return url.searchParams.get('api_key') || undefined;
}
