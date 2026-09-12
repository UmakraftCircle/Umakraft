import { HandbookSearchResult } from './handbook-types.js';

interface CacheEntry {
  results: HandbookSearchResult[];
  timestamp: number;
}

export class HandbookCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = 1000, ttlMs = 1000 * 60 * 60) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  private buildKey(query: string, category?: string): string {
    return `${query.trim().toLowerCase()}::${(category || '').trim().toLowerCase()}`;
  }

  public get(query: string, category?: string): HandbookSearchResult[] | undefined {
    const key = this.buildKey(query, category);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.results;
  }

  public set(query: string, results: HandbookSearchResult[], category?: string): void {
    const key = this.buildKey(query, category);
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      results,
      timestamp: Date.now()
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
