import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('CacheStore');
/**
 * Generic TTL-based cache with LRU eviction.
 *
 * Extracted from the fan-tracker domain as a shared platform service.
 * Supports namespaces for multi-tenant isolation and exposes stats for monitoring.
 */
export class CacheStore {
    store = new Map();
    config;
    hits = 0;
    misses = 0;
    evictions = 0;
    constructor(config = {}) {
        this.config = {
            defaultTTL: config.defaultTTL ?? 5 * 60 * 1000, // 5 minutes
            maxSize: config.maxSize ?? 1000,
            namespace: config.namespace ?? 'default',
        };
    }
    /**
     * Retrieve a cached value. Returns null on miss or expiry.
     */
    get(key) {
        const fullKey = this.nsKey(key);
        const entry = this.store.get(fullKey);
        if (!entry) {
            this.misses++;
            return null;
        }
        // Check TTL expiry
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.store.delete(fullKey);
            this.misses++;
            logger.debug(`Cache MISS (expired): ${fullKey}`);
            return null;
        }
        // Update last access for LRU tracking
        entry.lastAccess = Date.now();
        this.hits++;
        logger.debug(`Cache HIT: ${fullKey}`);
        return entry.data;
    }
    /**
     * Store a value in the cache with optional TTL override.
     */
    set(key, data, ttl) {
        const fullKey = this.nsKey(key);
        // Enforce max size via LRU eviction
        if (this.store.size >= this.config.maxSize && !this.store.has(fullKey)) {
            this.evictLRU();
        }
        this.store.set(fullKey, {
            data,
            timestamp: Date.now(),
            ttl: ttl ?? this.config.defaultTTL,
            lastAccess: Date.now(),
        });
        logger.debug(`Cache SET: ${fullKey} (TTL: ${ttl ?? this.config.defaultTTL}ms)`);
    }
    /**
     * Check if a key exists and is not expired (read-only — does not affect stats).
     */
    has(key) {
        const fullKey = this.nsKey(key);
        const entry = this.store.get(fullKey);
        if (!entry)
            return false;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.store.delete(fullKey);
            return false;
        }
        return true;
    }
    /**
     * Delete a specific key.
     */
    delete(key) {
        return this.store.delete(this.nsKey(key));
    }
    /**
     * Clear all entries in this namespace.
     */
    clear() {
        const size = this.store.size;
        this.store.clear();
        logger.info(`Cache cleared — removed ${size} entries from namespace "${this.config.namespace}"`);
    }
    /**
     * Get or compute: returns cached value or computes + caches + returns.
     */
    async getOrCompute(key, compute, ttl) {
        const cached = this.get(key);
        if (cached !== null)
            return cached;
        logger.debug(`Cache MISS (compute): ${this.nsKey(key)}`);
        const data = await compute();
        this.set(key, data, ttl);
        return data;
    }
    /**
     * Retrieve cache statistics for monitoring.
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.store.size,
            maxSize: this.config.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            evictions: this.evictions,
        };
    }
    /**
     * Return all non-expired keys in this namespace.
     */
    keys() {
        const now = Date.now();
        const prefix = this.config.namespace + ':';
        const keys = [];
        for (const [key, entry] of this.store) {
            if (now - entry.timestamp <= entry.ttl) {
                keys.push(key.slice(prefix.length));
            }
        }
        return keys;
    }
    /**
     * Reset all statistics counters (does not clear cache).
     */
    resetStats() {
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }
    // ── Private ──
    nsKey(key) {
        return `${this.config.namespace}:${key}`;
    }
    /**
     * Evict the least-recently-accessed entry.
     */
    evictLRU() {
        let oldestKey = null;
        let oldestAccess = Infinity;
        for (const [key, entry] of this.store) {
            if (entry.lastAccess < oldestAccess) {
                oldestAccess = entry.lastAccess;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.store.delete(oldestKey);
            this.evictions++;
            logger.debug(`LRU eviction: ${oldestKey}`);
        }
    }
}
//# sourceMappingURL=cache-store.js.map