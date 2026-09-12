export interface LanguagePattern {
  category: string;
  matchedText: string;
  frequency: number;
  examples: string[];
  lastObserved: Date;
}

export class PatternCollector {
  private patterns = new Map<string, LanguagePattern>();

  // Known recurring intent / structural patterns to track
  private patternRules: Array<{ category: string; regex: RegExp }> = [
    { category: 'parent_search', regex: /\b(?:need|want|find|search)\s+(?:a\s+)?(?:[a-z0-9\-]+\s+)*parent\b/i },
    { category: 'leaderboard', regex: /\b(?:fan\s+leaderboard|fan\s+ranking|top\s+fans|fan\s+ranks?)\b/i },
    { category: 'deck_building', regex: /\b(?:deck|support\s*cards?|build|card\s*setup)\b/i },
    { category: 'spark_route', regex: /\b(?:blue\s+spark|spark\s+route|factor\s+route)\b/i },
    { category: 'stat_goal', regex: /\b(?:target\s+stats?|stat\s+requirement|reach\s+\d+\s+speed)\b/i }
  ];

  /**
   * Collects repeated language patterns from text.
   */
  public collect(text: string): LanguagePattern[] {
    const matched: LanguagePattern[] = [];

    for (const rule of this.patternRules) {
      if (rule.regex.test(text)) {
        const existing = this.patterns.get(rule.category);
        if (existing) {
          existing.frequency += 1;
          existing.lastObserved = new Date();
          if (!existing.examples.includes(text) && existing.examples.length < 5) {
            existing.examples.push(text);
          }
          matched.push(existing);
        } else {
          const newPattern: LanguagePattern = {
            category: rule.category,
            matchedText: text,
            frequency: 1,
            examples: [text],
            lastObserved: new Date()
          };
          this.patterns.set(rule.category, newPattern);
          matched.push(newPattern);
        }
      }
    }

    return matched;
  }

  /**
   * Registers or increments a custom pattern category directly.
   */
  public recordPattern(category: string, exampleText: string, count: number = 1): LanguagePattern {
    const existing = this.patterns.get(category);
    if (existing) {
      existing.frequency += count;
      existing.lastObserved = new Date();
      if (!existing.examples.includes(exampleText) && existing.examples.length < 5) {
        existing.examples.push(exampleText);
      }
      return existing;
    }

    const newPattern: LanguagePattern = {
      category,
      matchedText: exampleText,
      frequency: count,
      examples: [exampleText],
      lastObserved: new Date()
    };
    this.patterns.set(category, newPattern);
    return newPattern;
  }

  public getPattern(category: string): LanguagePattern | undefined {
    return this.patterns.get(category);
  }

  public getAll(): LanguagePattern[] {
    return Array.from(this.patterns.values()).sort((a, b) => b.frequency - a.frequency);
  }

  public clear(): void {
    this.patterns.clear();
  }
}
