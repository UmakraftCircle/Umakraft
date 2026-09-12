import { AntonymEntry } from './antonym-entry.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class AntonymCache {
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
   * Prewarms the cache with popular words and initial opposite relationships.
   */
  public prewarm(entries: AntonymEntry[]): void {
    for (const entry of entries) {
      const cacheKey = `antonym:${entry.word.toLowerCase()}:${entry.context || ''}`;
      this.set(cacheKey, {
        found: true,
        word: entry.word,
        antonyms: entry.antonyms,
        relations: entry.relations || entry.antonyms.map(a => ({
          antonym: a,
          confidence: entry.confidence,
          context: entry.context,
          partOfSpeech: entry.partOfSpeech
        })),
        confidence: entry.confidence,
        context: entry.context
      });

      const fastListKey = `antonyms:${entry.word.toLowerCase()}`;
      if (!this.has(fastListKey)) {
        this.set(fastListKey, entry.antonyms);
      }
    }
  }
}
