import { VocabularyEntry } from './vocabulary-registry.js';
import { VocabularyResult } from './vocabulary-result.js';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class VocabularyCache {
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
   * Prewarms cache with popular common words, gaming, Discord, and Umakraft terms.
   */
  public prewarm(entries: VocabularyEntry[]): void {
    const popularWords = new Set([
      'run',
      'runner',
      'fast',
      'slow',
      'speed',
      'stamina',
      'power',
      'guts',
      'game',
      'play',
      'win',
      'lose',
      'chat',
      'bot',
      'server',
      'dm',
      'ping',
      'buff',
      'nerf',
      'meta',
      'gg',
      'race',
      'track',
      'champion'
    ]);

    for (const entry of entries) {
      const lower = entry.word.toLowerCase();
      if (popularWords.has(lower)) {
        const result: VocabularyResult = {
          word: entry.word,
          definition: entry.definition,
          partOfSpeech: entry.partOfSpeech,
          confidence: 1.0,
          language: entry.language,
          aliases: entry.aliases,
          metadata: entry.metadata
        };
        this.set(`word:${lower}`, result);
        this.set(`def:${lower}`, entry.definition);
        if (entry.aliases) {
          for (const alias of entry.aliases) {
            this.set(`alias:${alias.toLowerCase()}`, result);
          }
        }
      }
    }
  }
}
