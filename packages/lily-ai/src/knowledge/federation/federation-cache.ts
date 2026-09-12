import { FederatedResult } from './federation-result.js';

export interface FederatedCacheEntry {
  key: string;
  result: FederatedResult;
  expiresAt: number;
  createdAt: number;
}

export interface FederatedCacheOptions {
  defaultTtlMs?: number;
  maxEntries?: number;
}

export class FederationCache {
  private cache = new Map<string, FederatedCacheEntry>();
  private defaultTtlMs: number;
  private maxEntries: number;

  constructor(options: FederatedCacheOptions = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? 30_000; // 30s default TTL for federated queries
    this.maxEntries = options.maxEntries ?? 200;
  }

  private buildKey(queryText: string, userId?: string, guildId?: string): string {
    const norm = queryText.trim().toLowerCase();
    const u = userId || 'anonymous';
    const g = guildId || 'global';
    return `${g}::${u}::${norm}`;
  }

  public get(queryText: string, userId?: string, guildId?: string): FederatedResult | null {
    const key = this.buildKey(queryText, userId, guildId);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  public set(queryText: string, result: FederatedResult, userId?: string, guildId?: string, ttlMs?: number): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.buildKey(queryText, userId, guildId);
    const ttl = ttlMs ?? this.defaultTtlMs;

    this.cache.set(key, {
      key,
      result,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  public invalidate(queryText: string, userId?: string, guildId?: string): void {
    const key = this.buildKey(queryText, userId, guildId);
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
