export interface MatchResult {
  name: string;
  category: string;
  exactMatch?: boolean;
  taxonomyPriority?: number; // lower is higher priority
  popularity?: number; // higher is better
  usageFrequency?: number; // higher is better
}

export interface TopMatchClarification {
  type: 'top_match';
  query: string;
  matches: MatchResult[];
}

export class TopMatchClarificationEngine {
  /**
   * Sorts matches based on ranking rules:
   * 1. Exact Match
   * 2. Taxonomy Priority
   * 3. Popularity
   * 4. Usage Frequency
   */
  public sortMatches(matches: MatchResult[]): MatchResult[] {
    return [...matches].sort((a, b) => {
      // 1. Exact Match
      const aExact = a.exactMatch ? 1 : 0;
      const bExact = b.exactMatch ? 1 : 0;
      if (aExact !== bExact) {
        return bExact - aExact;
      }

      // 2. Taxonomy Priority (lower is higher priority)
      const aTax = a.taxonomyPriority ?? 999;
      const bTax = b.taxonomyPriority ?? 999;
      if (aTax !== bTax) {
        return aTax - bTax;
      }

      // 3. Popularity (higher is better)
      const aPop = a.popularity ?? 0;
      const bPop = b.popularity ?? 0;
      if (aPop !== bPop) {
        return bPop - aPop;
      }

      // 4. Usage Frequency (higher is better)
      const aFreq = a.usageFrequency ?? 0;
      const bFreq = b.usageFrequency ?? 0;
      return bFreq - aFreq;
    });
  }

  public resolve(text: string): TopMatchClarification | null {
    const normalized = text.toLowerCase().trim();

    if (normalized.includes('rudolf')) {
      const candidates: MatchResult[] = [
        {
          name: 'Symboli Rudolf',
          category: 'Character',
          exactMatch: false,
          taxonomyPriority: 1,
          popularity: 95,
          usageFrequency: 80
        },
        {
          name: 'Rudolf Support Card',
          category: 'Support Card',
          exactMatch: false,
          taxonomyPriority: 2,
          popularity: 85,
          usageFrequency: 75
        },
        {
          name: 'Rudolf Event',
          category: 'Event',
          exactMatch: false,
          taxonomyPriority: 3,
          popularity: 50,
          usageFrequency: 30
        }
      ];

      return {
        type: 'top_match',
        query: 'Rudolf',
        matches: this.sortMatches(candidates)
      };
    }

    return null;
  }
}
