import * as crypto from 'crypto';
import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('Auth');
// ── API Key Store ──
class ApiKeyStore {
    keys = new Set();
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
        }
        else if (envKey) {
            logger.info('Loaded 1 API key from API_KEY.');
        }
    }
    validate(key) {
        return this.keys.has(key);
    }
    addKey(key) {
        this.keys.add(key);
    }
    revokeKey(key) {
        this.keys.delete(key);
    }
    keyCount() {
        return this.keys.size;
    }
}
class RateLimiter {
    buckets = new Map();
    config;
    refillRate;
    cleanupTimer = null;
    constructor(config) {
        this.config = {
            windowMs: config.windowMs,
            maxRequests: config.maxRequests,
        };
        this.refillRate = config.maxRequests / config.windowMs;
        // Periodic stale bucket cleanup — runs every 60 seconds
        this.cleanupTimer = setInterval(() => this.cleanupStale(Date.now()), 60_000);
        // Allow garbage collection of the timer if the instance is discarded
        if (this.cleanupTimer.unref)
            this.cleanupTimer.unref();
    }
    /**
     * Stop the cleanup timer. Call when shutting down the server.
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
    consume(clientId) {
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
    remainingTokens(clientId) {
        const bucket = this.buckets.get(clientId);
        if (!bucket)
            return this.config.maxRequests;
        const elapsed = Date.now() - bucket.lastRefill;
        const newTokens = elapsed * this.refillRate;
        return Math.min(this.config.maxRequests, bucket.tokens + newTokens);
    }
    retryAfterMs(clientId) {
        const bucket = this.buckets.get(clientId);
        if (!bucket || bucket.tokens >= 1)
            return 0;
        return Math.ceil((1 - bucket.tokens) / this.refillRate);
    }
    cleanupStale(now) {
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
const DEFAULT_RATE_LIMIT = {
    windowMs: 60 * 1000,
    maxRequests: 100,
};
export class AuthMiddleware {
    keyStore;
    rateLimiter;
    config;
    constructor(config = {}) {
        this.keyStore = new ApiKeyStore();
        this.rateLimiter = new RateLimiter(config.rateLimit || DEFAULT_RATE_LIMIT);
        this.config = {
            requireAuth: config.requireAuth ?? true,
            rateLimit: config.rateLimit || DEFAULT_RATE_LIMIT,
            publicPaths: config.publicPaths ?? ['/health'],
        };
        // Warn on startup if auth is required but no keys are configured
        if (this.config.requireAuth && this.keyStore.keyCount() === 0) {
            logger.warn('Auth is enabled (requireAuth=true) but no API keys are configured. ' +
                'Set API_KEY or API_KEYS environment variable, or all requests will be rejected.');
        }
    }
    /**
     * Stop background timers. Call during graceful shutdown.
     */
    destroy() {
        this.rateLimiter.destroy();
    }
    /**
     * Main middleware handler. Returns AuthContext if request should proceed,
     * or null if response was already sent (401/429).
     */
    async handle(req, res) {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        // ── 1. Public path bypass ──
        if (this.config.publicPaths.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
            return { authenticated: false, publicPath: true };
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
        const apiKey = extractApiKey(req);
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
            apiKey,
            clientId,
            publicPath: false,
        };
    }
    addApiKey(key) {
        this.keyStore.addKey(key);
        logger.info('API key added programmatically.');
    }
    revokeApiKey(key) {
        this.keyStore.revokeKey(key);
        logger.info('API key revoked.');
    }
    getKeyCount() {
        return this.keyStore.keyCount();
    }
    /**
     * Derive a stable client identifier that does NOT leak key material.
     * Uses a SHA-256 hash prefix of the API key — same key always maps to
     * the same bucket, but a client cannot infer their key from the hash.
     */
    getClientId(req) {
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            const apiKey = authHeader.slice(7);
            const hash = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
            return `key:${hash}`;
        }
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            return `ip:${forwarded.split(',')[0].trim()}`;
        }
        return `ip:${req.socket.remoteAddress || 'unknown'}`;
    }
}
// ── Helper: extract API key from request ──
export function extractApiKey(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    return url.searchParams.get('api_key') || undefined;
}
//# sourceMappingURL=auth.js.map