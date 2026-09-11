import { createLogger } from './logger.js';

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
 * Generic TTL-based cache with LRU eviction, in-flight request deduplication,
 * and automatic expired-entry sweeping.
 */
export class CacheStore<T = any> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private promises: Map<string, Promise<T>> = new Map(); // in-flight dedup
  private config: Required<CacheStoreConfig>;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private evictLock = false; // prevents concurrent eviction loops

  constructor(config: CacheStoreConfig = {}) {
    this.config = {
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000, // 5 minutes
      maxSize: config.maxSize ?? 1000,
      namespace: config.namespace ?? 'default',
    };

    // Sweep expired entries every 60 seconds
    this.sweepTimer = setInterval(() => this.sweepExpired(), 60_000);
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  /** Stop background sweep timer. */
  public destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  private scopedKey(key: string): string {
    return `${this.config.namespace}:${key}`;
  }

  /** Read value if present and unexpired. Updates LRU order. */
  public get<ValueT = T>(key: string): ValueT | undefined {
    const fullKey = this.scopedKey(key);
    const entry = this.store.get(fullKey);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(fullKey);
      this.misses++;
      return undefined;
    }

    // Refresh LRU position by re-inserting
    entry.lastAccess = Date.now();
    this.store.delete(fullKey);
    this.store.set(fullKey, entry);

    this.hits++;
    return entry.data as unknown as ValueT;
  }

  /** Write value with explicit TTL or fallback to defaultTTL. */
  public set(key: string, data: T, ttlMs?: number): void {
    const fullKey = this.scopedKey(key);
    const ttl = ttlMs ?? this.config.defaultTTL;

    // Evict if over maxSize and adding new key
    if (!this.store.has(fullKey) && this.store.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.store.set(fullKey, {
      data,
      timestamp: Date.now(),
      ttl,
      lastAccess: Date.now(),
    });
  }

  /** Read value; if missing/expired, invoke fetcher, store result, return it. Deduplicates concurrent callers. */
  public async getOrFetch(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const fullKey = this.scopedKey(key);

    // In-flight request deduplication
    if (this.promises.has(fullKey)) {
      return this.promises.get(fullKey)!;
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, ttlMs);
        return result;
      } finally {
        this.promises.delete(fullKey);
      }
    })();

    this.promises.set(fullKey, promise);
    return promise;
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: string): boolean {
    return this.store.delete(this.scopedKey(key));
  }

  public clear(): void {
    this.store.clear();
    this.promises.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(4)) : 0,
      evictions: this.evictions,
    };
  }

  private evictLRU(): void {
    if (this.evictLock) return;
    this.evictLock = true;

    try {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, entry] of this.store.entries()) {
        if (entry.lastAccess < oldestTime) {
          oldestTime = entry.lastAccess;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.store.delete(oldestKey);
        this.evictions++;
      }
    } finally {
      this.evictLock = false;
    }
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
      }
    }
  }
}
