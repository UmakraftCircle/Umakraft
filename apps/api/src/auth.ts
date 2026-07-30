/**
 * Auth Middleware for the API Server
 * 
 * Token-based authentication and rate limiting for the raw HTTP server.
 */
import * as http from 'http';
import * as crypto from 'crypto';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Auth');

// ── Types ──

export interface AuthContext {
  authenticated: boolean;
  apiKey?: string;
  clientId?: string;
  publicPath: boolean;   // true if request matched a public path (distinct from un-authenticated)
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// ── API Key Store ──

class ApiKeyStore {
  private keys: Set<string> = new Set();

  constructor() {
    const envKey = process.env['API_KEY'];
    if (envKey) {
      this.keys.add(envKey.trim());
    }

    const multiKeys = process.env['API_KEYS'];
    if (multiKeys) {
      const split = multiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
      for (const key of split) {
        this.keys.add(key);
      }
      logger.info(`Loaded ${split.length} API key(s) from API_KEYS.`);
    } else if (envKey) {
      logger.info('Loaded 1 API key from API_KEY.');
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
  private refillRate: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
    };
    this.refillRate = config.maxRequests / config.windowMs;

    // Periodic stale bucket cleanup — runs every 60 seconds
    this.cleanupTimer = setInterval(() => this.cleanupStale(Date.now()), 60_000);
    // Allow garbage collection of the timer if the instance is discarded
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Stop the cleanup timer. Call when shutting down the server.
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  public consume(clientId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      bucket = { tokens: this.config.maxRequests, lastRefill: now };
      this.buckets.set(clientId, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    const newTokens = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.config.maxRequests, bucket.tokens + newTokens);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  public remainingTokens(clientId: string): number {
    const bucket = this.buckets.get(clientId);
    if (!bucket) return this.config.maxRequests;
    const elapsed = Date.now() - bucket.lastRefill;
    const newTokens = elapsed * this.refillRate;
    return Math.min(this.config.maxRequests, bucket.tokens + newTokens);
  }

  public retryAfterMs(clientId: string): number {
    const bucket = this.buckets.get(clientId);
    if (!bucket || bucket.tokens >= 1) return 0;
    return Math.ceil((1 - bucket.tokens) / this.refillRate);
  }

  private cleanupStale(now: number): void {
    const idleThreshold = 5 * 60 * 1000; // 5 min
    let removed = 0;
    for (const [clientId, bucket] of this.buckets) {
      if (now - bucket.lastRefill > idleThreshold && bucket.tokens >= this.config.maxRequests * 0.9) {
        this.buckets.delete(clientId);
        removed++;
      }
    }
    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} stale rate-limit buckets.`);
    }
  }
}

// ── Auth Middleware ──

export interface AuthMiddlewareConfig {
  requireAuth?: boolean;
  rateLimit?: RateLimitConfig;
  publicPaths?: string[];
  /** If true, trust x-forwarded-for header for client IP. Only enable behind a known reverse proxy. */
  trustProxy?: boolean;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
};

export class AuthMiddleware {
  private keyStore: ApiKeyStore;
  private rateLimiter: RateLimiter;
  private config: Required<AuthMiddlewareConfig>;
  private authEnabled: boolean;

  constructor(config: AuthMiddlewareConfig = {}) {
    this.keyStore = new ApiKeyStore();
    this.rateLimiter = new RateLimiter(config.rateLimit || DEFAULT_RATE_LIMIT);
    this.config = {
      requireAuth: config.requireAuth ?? true,
      rateLimit: config.rateLimit || DEFAULT_RATE_LIMIT,
      publicPaths: config.publicPaths ?? ['/health'],
      trustProxy: config.trustProxy ?? false,
    };

    // Auth is only enforced when both requireAuth is true AND keys exist.
    // If requireAuth is true but no keys are configured, reject all requests
    // to prevent accidentally running an open server.
    this.authEnabled = this.config.requireAuth && this.keyStore.keyCount() > 0;

    if (this.config.requireAuth && this.keyStore.keyCount() === 0) {
      logger.error(
        'CRITICAL: requireAuth=true but no API keys are configured. ' +
        'ALL non-public requests will be rejected (503). ' +
        'Set API_KEY or API_KEYS environment variable, or set requireAuth=false.'
      );
    }

    if (this.authEnabled) {
      logger.info(`Auth enabled: ${this.keyStore.keyCount()} API key(s) loaded.`);
    } else if (!this.config.requireAuth) {
      logger.warn('Auth disabled (requireAuth=false). All requests are open.');
    }
  }

  /**
   * Stop background timers. Call during graceful shutdown.
   */
  public destroy(): void {
    this.rateLimiter.destroy();
  }

  /**
   * Main middleware handler. Returns AuthContext if request should proceed,
   * or null if response was already sent (401/429).
   */
  public async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<AuthContext | null> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // ── 1. Public path bypass (exact match only — no prefix wildcard) ──
    if (this.config.publicPaths.some(p => url.pathname === p)) {
      return { authenticated: false, publicPath: true };
    }

    // ── 2. Auth required but no keys → reject all ──
    if (this.config.requireAuth && this.keyStore.keyCount() === 0) {
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Retry-After': '300',
      });
      res.end(JSON.stringify({
        error: 'Service Unavailable',
        message: 'Authentication is enabled but no API keys are configured. ' +
          'Contact the administrator to set up API_KEY or API_KEYS.',
      }));
      logger.error('Request rejected: requireAuth=true but no keys configured.');
      return null;
    }

    // ── 3. Rate limiting ──
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

    // ── 4. Auth check ──
    const apiKey = extractApiKey(req);

    if (this.authEnabled) {
      if (!apiKey || !this.keyStore.validate(apiKey)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Unauthorized',
          message: 'Valid API key required. Provide via Authorization: Bearer <key> header.',
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
      apiKey,
      clientId,
      publicPath: false,
    };
  }

  public addApiKey(key: string): void {
    this.keyStore.addKey(key);
    this.authEnabled = this.config.requireAuth && this.keyStore.keyCount() > 0;
    logger.info('API key added programmatically.');
  }

  public revokeApiKey(key: string): void {
    this.keyStore.revokeKey(key);
    this.authEnabled = this.config.requireAuth && this.keyStore.keyCount() > 0;
    logger.info('API key revoked.');
  }

  public getKeyCount(): number {
    return this.keyStore.keyCount();
  }

  public isAuthEnabled(): boolean {
    return this.authEnabled;
  }

  /**
   * Derive a stable client identifier.
   *
   * - If a valid Authorization header is present, hash the key prefix
   *   so the same key always maps to the same bucket.
   * - Otherwise use the socket's remote address.
   * - x-forwarded-for is only trusted when `trustProxy` is explicitly enabled.
   */
  private getClientId(req: http.IncomingMessage): string {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const hash = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
      return `key:${hash}`;
    }

    // Only trust x-forwarded-for when explicitly behind a known proxy
    if (this.config.trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return `ip:${forwarded.split(',')[0].trim()}`;
      }
    }

    return `ip:${req.socket.remoteAddress || 'unknown'}`;
  }
}

// ── Helper: extract API key from request (Authorization header only) ──

export function extractApiKey(req: http.IncomingMessage): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return undefined;
}
