export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    ttl: number;
    lastAccess: number;
}
export interface CacheStats {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
}
export interface CacheStoreConfig {
    defaultTTL?: number;
    maxSize?: number;
    namespace?: string;
}
/**
 * Generic TTL-based cache with LRU eviction.
 *
 * Extracted from the fan-tracker domain as a shared platform service.
 * Supports namespaces for multi-tenant isolation and exposes stats for monitoring.
 */
export declare class CacheStore<T = any> {
    private store;
    private config;
    private hits;
    private misses;
    private evictions;
    constructor(config?: CacheStoreConfig);
    /**
     * Retrieve a cached value. Returns null on miss or expiry.
     */
    get<U = T>(key: string): U | null;
    /**
     * Store a value in the cache with optional TTL override.
     */
    set(key: string, data: T, ttl?: number): void;
    /**
     * Check if a key exists and is not expired (read-only — does not affect stats).
     */
    has(key: string): boolean;
    /**
     * Delete a specific key.
     */
    delete(key: string): boolean;
    /**
     * Clear all entries in this namespace.
     */
    clear(): void;
    /**
     * Get or compute: returns cached value or computes + caches + returns.
     */
    getOrCompute(key: string, compute: () => Promise<T>, ttl?: number): Promise<T>;
    /**
     * Retrieve cache statistics for monitoring.
     */
    getStats(): CacheStats;
    /**
     * Return all non-expired keys in this namespace.
     */
    keys(): string[];
    /**
     * Reset all statistics counters (does not clear cache).
     */
    resetStats(): void;
    private nsKey;
    /**
     * Evict the least-recently-accessed entry.
     */
    private evictLRU;
}
//# sourceMappingURL=cache-store.d.ts.map