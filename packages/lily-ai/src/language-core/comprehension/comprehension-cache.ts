import { ComprehensionResult } from './reading-comprehension-engine.js';

export class ComprehensionCache {
  private cache = new Map<string, ComprehensionResult>();

  public get(text: string): ComprehensionResult | undefined {
    return this.cache.get(text.trim().toLowerCase());
  }

  public set(text: string, result: ComprehensionResult): void {
    this.cache.set(text.trim().toLowerCase(), result);
  }

  public clear(): void {
    this.cache.clear();
  }
}
