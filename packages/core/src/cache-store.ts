import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('CacheStore');

// ── Types ──

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
  defaultTTL?: number;    // milliseconds (default: 5 min)
  maxSize?: number;        // max entries before LRU eviction (default: 1000)
  namespace?: string;      // prefix for key isolation
}

/**
 * Generic TTL-based cache with LRU eviction.
 * 
 * Extracted from the fan-tracker domain as a shared platform service.
 * Supports namespaces for multi-tenant isolation and exposes stats for monitoring.
 */
export class CacheStore<T = any> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private config: Required<CacheStoreConfig>;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(config: CacheStoreConfig = {}) {
    this.config = {
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000, // 5 minutes
      maxSize: config.maxSize ?? 1000,
      namespace: config.namespace ?? 'default',
    };
  }

  /**
   * Retrieve a cached value. Returns null on miss or expiry.
   */
  public get(key: string): T | null {
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
  public set(key: string, data: T, ttl?: number): void {
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
  public has(key: string): boolean {
    const fullKey = this.nsKey(key);
    const entry = this.store.get(fullKey);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(fullKey);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key.
   */
  public delete(key: string): boolean {
    return this.store.delete(this.nsKey(key));
  }

  /**
   * Clear all entries in this namespace.
   */
  public clear(): void {
    const size = this.store.size;
    this.store.clear();
    logger.info(`Cache cleared — removed ${size} entries from namespace "${this.config.namespace}"`);
  }

  /**
   * Get or compute: returns cached value or computes + caches + returns.
   */
  public async getOrCompute(key: string, compute: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) return cached;

    logger.debug(`Cache MISS (compute): ${this.nsKey(key)}`);
    const data = await compute();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Retrieve cache statistics for monitoring.
   */
  public getStats(): CacheStats {
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
  public keys(): string[] {
    const now = Date.now();
    const prefix = this.config.namespace + ':';
    const keys: string[] = [];

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
  public resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  // ── Private ──

  private nsKey(key: string): string {
    return `${this.config.namespace}:${key}`;
  }

  /**
   * Evict the least-recently-accessed entry.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
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
