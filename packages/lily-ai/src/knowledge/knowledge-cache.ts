import { KnowledgeResult } from './knowledge-result.js';

export class KnowledgeCache {
  private cache = new Map<string, { result: KnowledgeResult[]; expiresAt: number }>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  private buildKey(term: string, contextKey?: string): string {
    return `${term.trim().toLowerCase()}::${contextKey || ''}`;
  }

  public get(term: string, contextKey?: string): KnowledgeResult[] | undefined {
    const key = this.buildKey(term, contextKey);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.result;
  }

  public set(term: string, result: KnowledgeResult[], contextKey?: string, ttlMs?: number): void {
    const key = this.buildKey(term, contextKey);
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { result, expiresAt });
  }

  public has(term: string, contextKey?: string): boolean {
    return this.get(term, contextKey) !== undefined;
  }

  public delete(term: string, contextKey?: string): boolean {
    const key = this.buildKey(term, contextKey);
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
