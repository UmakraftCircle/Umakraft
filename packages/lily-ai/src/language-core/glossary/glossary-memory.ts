export interface GlossaryUsage {
  term: string;
  count: number;
  lastUsed: Date;
}

export class GlossaryMemory {
  private usages = new Map<string, GlossaryUsage>();

  /**
   * Record usage of a glossary term
   */
  public record(term: string): void {
    const cleanTerm = term.toLowerCase().trim();
    if (!cleanTerm) return;

    const existing = this.usages.get(cleanTerm);
    if (existing) {
      existing.count += 1;
      existing.lastUsed = new Date();
    } else {
      this.usages.set(cleanTerm, {
        term: cleanTerm,
        count: 1,
        lastUsed: new Date()
      });
    }
  }

  /**
   * Retrieves usage record of a term
   */
  public getUsage(term: string): GlossaryUsage | undefined {
    return this.usages.get(term.toLowerCase().trim());
  }

  /**
   * Get all usages
   */
  public getAllUsages(): GlossaryUsage[] {
    return Array.from(this.usages.values());
  }

  /**
   * Clears usage history
   */
  public clear(): void {
    this.usages.clear();
  }
}
