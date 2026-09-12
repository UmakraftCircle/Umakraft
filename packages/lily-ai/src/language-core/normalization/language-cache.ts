export interface CorrectionCacheEntry {
  input: string;
  result: string;
  confidence: number;
}

export class LanguageCache {
  private cache = new Map<string, CorrectionCacheEntry>();

  public get(input: string): CorrectionCacheEntry | undefined {
    return this.cache.get(input.toLowerCase().trim());
  }

  public set(input: string, result: string, confidence: number): void {
    this.cache.set(input.toLowerCase().trim(), {
      input,
      result,
      confidence
    });
  }

  public clear(): void {
    this.cache.clear();
  }
}
