import { LexicalResult } from './lexical-result.js';
import { LexicalQuery } from './lexical-query.js';

interface CacheEntry {
  result: LexicalResult;
  timestamp: number;
}

export class LexicalCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = 2000, ttlMs = 1000 * 60 * 60) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  private buildKey(query: LexicalQuery | string): string {
    if (typeof query === 'string') {
      return query.trim().toLowerCase();
    }
    const text = query.text.trim().toLowerCase();
    const context = (query.context || '').trim().toLowerCase();
    const lang = query.language || 'en';
    return `${text}::${context}::${lang}`;
  }

  public get(query: LexicalQuery | string): LexicalResult | undefined {
    const key = this.buildKey(query);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU position
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.result;
  }

  public set(query: LexicalQuery | string, result: LexicalResult): void {
    const key = this.buildKey(query);
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  public has(query: LexicalQuery | string): boolean {
    return this.get(query) !== undefined;
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
