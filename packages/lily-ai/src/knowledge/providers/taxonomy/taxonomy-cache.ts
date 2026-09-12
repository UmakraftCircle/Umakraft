import { TaxonomyNode } from './taxonomy-loader.js';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TaxonomyCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 1000 * 60 * 60) { // 1 hour default TTL
    this.defaultTtlMs = defaultTtlMs;
  }

  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key.toLowerCase());
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key.toLowerCase());
      return undefined;
    }

    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key.toLowerCase(), { value, expiresAt });
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: string): boolean {
    return this.cache.delete(key.toLowerCase());
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  /**
   * Prewarms the cache with popular characters, skills, running styles, and frequently used races.
   */
  public prewarm(nodes: TaxonomyNode[]): void {
    const popularIds = [
      'running_style.front_runner',
      'running_style.pace_chaser',
      'running_style.late_surger',
      'running_style.end_closer',
      'character.symboli_rudolf',
      'character.oguri_cap',
      'character.tokai_teio',
      'character.mejiro_mcqueen',
      'skill.concentration',
      'skill.professor_of_curvature',
      'race.arima_kinen',
      'race.japan_cup'
    ];

    for (const node of nodes) {
      if (popularIds.includes(node.id) || node.category === 'Running Style') {
        this.set(`id:${node.id}`, node);
        this.set(`name:${node.name}`, node);
        for (const alias of node.aliases) {
          this.set(`alias:${alias}`, node);
        }
      }
    }
  }
}
