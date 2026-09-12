import { DatabaseKnowledgeResult } from './database-result.js';

export interface DatabaseCacheEntry {
  key: string;
  results: DatabaseKnowledgeResult[];
  expiresAt: number;
  createdAt: number;
}

export interface DatabaseCacheConfig {
  defaultTtlMs?: number;
  entityTtlMs?: Record<string, number>;
  maxEntries?: number;
}

export class DatabaseCache {
  private entries = new Map<string, DatabaseCacheEntry>();
  private defaultTtlMs: number;
  private entityTtlMs: Record<string, number>;
  private maxEntries: number;

  constructor(config: DatabaseCacheConfig = {}) {
    this.defaultTtlMs = config.defaultTtlMs ?? 60_000; // 60s default TTL
    this.entityTtlMs = config.entityTtlMs ?? {
      leaderboard: 30_000, // 30s
      club: 60_000,        // 60s
      trainer: 45_000,     // 45s
      fan_gain: 45_000,    // 45s
      milestone: 300_000   // 5m
    };
    this.maxEntries = config.maxEntries ?? 1000;
  }

  private generateKey(queryKey: string, userContextKey?: string): string {
    return userContextKey ? `${queryKey}::${userContextKey}` : queryKey;
  }

  public get(queryKey: string, userContextKey?: string): DatabaseKnowledgeResult[] | null {
    const key = this.generateKey(queryKey, userContextKey);
    const entry = this.entries.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }

    return entry.results;
  }

  public set(
    queryKey: string,
    results: DatabaseKnowledgeResult[],
    userContextKey?: string,
    customTtlMs?: number
  ): void {
    if (this.entries.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) this.entries.delete(oldestKey);
    }

    const key = this.generateKey(queryKey, userContextKey);
    const firstType = results[0]?.entityType;
    const ttl = customTtlMs ?? (firstType && this.entityTtlMs[firstType]) ?? this.defaultTtlMs;

    this.entries.set(key, {
      key,
      results,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  public invalidate(patternOrPrefix: string): void {
    for (const key of Array.from(this.entries.keys())) {
      if (key.startsWith(patternOrPrefix) || key.includes(patternOrPrefix)) {
        this.entries.delete(key);
      }
    }
  }

  public clear(): void {
    this.entries.clear();
  }

  public size(): number {
    return this.entries.size;
  }
}
