import { DictionaryEntry } from './dictionary-entry.js';

export class DictionaryCache {
  private cache = new Map<string, { value: any; timestamp: number }>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 1000, ttlMs: number = 1000 * 60 * 60) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  public get<T = any>(key: string): T | undefined {
    if (!key) return undefined;
    const cleanKey = key.toLowerCase().trim();
    const item = this.cache.get(cleanKey);
    if (!item) return undefined;

    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(cleanKey);
      return undefined;
    }

    // Move to end (LRU behavior)
    this.cache.delete(cleanKey);
    this.cache.set(cleanKey, { value: item.value, timestamp: Date.now() });

    return item.value as T;
  }

  public set(key: string, value: any): void {
    if (!key) return;
    const cleanKey = key.toLowerCase().trim();

    // Evict oldest if capacity exceeded
    if (this.cache.size >= this.maxEntries && !this.cache.has(cleanKey)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cleanKey, { value, timestamp: Date.now() });
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public size(): number {
    return this.cache.size;
  }

  public clear(): void {
    this.cache.clear();
  }

  /**
   * Prewarms the cache with popular words and high-confidence dictionary entries.
   */
  public prewarm(entries: DictionaryEntry[]): void {
    if (!entries || !Array.isArray(entries)) return;
    for (const entry of entries) {
      if (entry && entry.word) {
        this.set(`word:${entry.word.toLowerCase()}`, entry);
        if (entry.normalizedWord) {
          this.set(`word:${entry.normalizedWord.toLowerCase()}`, entry);
        }
      }
    }
  }
}
