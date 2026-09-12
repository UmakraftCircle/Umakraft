import { SynonymEntry } from './synonym-entry.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SynonymCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxCapacity: number;
  private defaultTtlMs: number;

  constructor(maxCapacity = 2000, defaultTtlMs = 1000 * 60 * 60 * 24) {
    this.maxCapacity = maxCapacity;
    this.defaultTtlMs = defaultTtlMs;
  }

  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxCapacity) {
      // Evict oldest entry (LRU)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs)
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  /**
   * Prewarms the cache with popular words and initial relationships.
   */
  public prewarm(entries: SynonymEntry[]): void {
    for (const entry of entries) {
      this.set(`synonyms:${entry.word.toLowerCase()}`, entry.synonyms);
    }
  }
}
