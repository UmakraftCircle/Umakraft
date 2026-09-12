export interface IntentHint {
  possibleIntent: string;
  confidence: number;
}

export class IntentHints {
  /**
   * Evaluates text patterns to generate intent hints for agent routers
   */
  public generateHints(text: string): IntentHint[] {
    const normalized = text.toLowerCase();
    const hints: IntentHint[] = [];

    if (normalized.includes('parent') || normalized.includes('breeding')) {
      hints.push({ possibleIntent: 'ParentSearch', confidence: 0.95 });
    }

    if (normalized.includes('build') || normalized.includes('setup') || normalized.includes('optimize')) {
      hints.push({ possibleIntent: 'BuildOptimization', confidence: 0.92 });
    }

    if (normalized.includes('report') || normalized.includes('stats') || normalized.includes('fans')) {
      hints.push({ possibleIntent: 'PerformanceReport', confidence: 0.88 });
    }

    if (normalized.includes('club') || normalized.includes('link') || normalized.includes('approval')) {
      hints.push({ possibleIntent: 'ClubOperation', confidence: 0.94 });
    }

    if (normalized.includes('leaderboard') || normalized.includes('rank') || normalized.includes('score')) {
      hints.push({ possibleIntent: 'LeaderboardView', confidence: 0.90 });
    }

    if (normalized.includes('hello') || normalized.includes('hi') || normalized.includes('how are you')) {
      hints.push({ possibleIntent: 'GeneralChat', confidence: 0.95 });
    }

    // Sort hints by confidence descending
    return hints.sort((a, b) => b.confidence - a.confidence);
  }
}
