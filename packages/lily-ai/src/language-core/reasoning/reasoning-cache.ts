export class ReasoningCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private defaultTtl: number;

  constructor(defaultTtl = 5 * 60 * 1000) {
    this.defaultTtl = defaultTtl;
  }

  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttl = this.defaultTtl): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
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
}
