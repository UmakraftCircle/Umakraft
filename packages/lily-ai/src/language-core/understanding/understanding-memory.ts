export class UnderstandingMemory {
  private patterns = new Map<string, string>();
  private usageCount = new Map<string, number>();

  /**
   * Learns a recurrent language pattern mapping an alias or shorthand to its canonical form
   */
  public learnPattern(shorthand: string, canonical: string): void {
    const key = shorthand.trim().toLowerCase();
    this.patterns.set(key, canonical.trim());
    this.usageCount.set(key, (this.usageCount.get(key) || 0) + 1);
  }

  /**
   * Resolves a shorthand term if a learned pattern exists
   */
  public resolvePattern(shorthand: string): string | undefined {
    return this.patterns.get(shorthand.trim().toLowerCase());
  }

  /**
   * Returns how many times a pattern has been reinforced or used
   */
  public getPatternStrength(shorthand: string): number {
    return this.usageCount.get(shorthand.trim().toLowerCase()) || 0;
  }

  /**
   * Clears the learned pattern memory
   */
  public clear(): void {
    this.patterns.clear();
    this.usageCount.clear();
  }
}
