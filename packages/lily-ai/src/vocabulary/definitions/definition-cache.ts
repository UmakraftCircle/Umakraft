import { Definition } from './definition-source.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class DefinitionCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxCapacity: number;
  private defaultTtlMs: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxCapacity: number = 2000, defaultTtlMs: number = 1000 * 60 * 60) {
    this.maxCapacity = maxCapacity;
    this.defaultTtlMs = defaultTtlMs;
  }

  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxCapacity) {
      // Evict oldest item (first key in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public size(): number {
    return this.cache.size;
  }

  public getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(4)) : 0
    };
  }

  /**
   * Prewarms the cache with popular and high-frequency definitions.
   */
  public prewarm(definitions: Definition[]): void {
    for (const def of definitions) {
      const cacheKey = `def:${def.word.toLowerCase()}:${def.context || 'general'}`;
      this.set(cacheKey, def);

      const simpleKey = `def:${def.word.toLowerCase()}`;
      if (!this.has(simpleKey)) {
        this.set(simpleKey, def);
      }
    }
  }
}
