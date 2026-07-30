/**
 * Auth Middleware for the API Server
 *
 * Token-based authentication and rate limiting for the raw HTTP server.
 */
import * as http from 'http';
export interface AuthContext {
    authenticated: boolean;
    apiKey?: string;
    clientId?: string;
    publicPath: boolean;
}
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}
export interface AuthMiddlewareConfig {
    requireAuth?: boolean;
    rateLimit?: RateLimitConfig;
    publicPaths?: string[];
}
export declare class AuthMiddleware {
    private keyStore;
    private rateLimiter;
    private config;
    constructor(config?: AuthMiddlewareConfig);
    /**
     * Stop background timers. Call during graceful shutdown.
     */
    destroy(): void;
    /**
     * Main middleware handler. Returns AuthContext if request should proceed,
     * or null if response was already sent (401/429).
     */
    handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<AuthContext | null>;
    addApiKey(key: string): void;
    revokeApiKey(key: string): void;
    getKeyCount(): number;
    /**
     * Derive a stable client identifier that does NOT leak key material.
     * Uses a SHA-256 hash prefix of the API key — same key always maps to
     * the same bucket, but a client cannot infer their key from the hash.
     */
    private getClientId;
}
export declare function extractApiKey(req: http.IncomingMessage): string | undefined;
//# sourceMappingURL=auth.d.ts.map