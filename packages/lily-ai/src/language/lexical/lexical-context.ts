export interface ContextResolutionResult {
  bestDefinition?: string;
  domain?: string;
  score: number;
  matchedKeywords: string[];
}

export class LexicalContextResolver {
  private domainKeywords: Record<string, string[]> = {
    umamusume: [
      'umamusume', 'horse', 'girl', 'race', 'racetrack', 'trainer', 'training', 'stat',
      'speed', 'stamina', 'power', 'guts', 'wit', 'spark', 'inheritance', 'parent',
      'skill', 'fan', 'debut', 'g1', 'g2', 'g3', 'turf', 'dirt', 'sprint', 'mile',
      'medium', 'long', 'front runner', 'pace', 'late', 'spurt'
    ],
    racing: [
      'race', 'track', 'lap', 'speed', 'stamina', 'position', 'pace', 'finish',
      'runner', 'sprint', 'distance', 'corner', 'stretch', 'lead', 'tactics', 'strategy'
    ],
    general: [
      'general', 'common', 'everyday', 'standard', 'basic', 'definition', 'meaning'
    ],
    technology: [
      'computer', 'software', 'hardware', 'code', 'program', 'system', 'data', 'algorithm'
    ]
  };

  /**
   * Resolves the most accurate definition and domain given a contextual query or domain clue.
   */
  public resolveContext(
    term: string,
    context?: string,
    candidateDefinitions: string[] = []
  ): ContextResolutionResult {
    if (!context || candidateDefinitions.length === 0) {
      return {
        bestDefinition: candidateDefinitions[0],
        domain: 'general',
        score: candidateDefinitions.length > 0 ? 0.8 : 0.0,
        matchedKeywords: []
      };
    }

    const normalizedContext = context.toLowerCase();
    const contextWords = normalizedContext.split(/[^a-z0-9_-]+/i).filter(w => w.length > 2);

    let bestScore = -1;
    let bestDef = candidateDefinitions[0];
    let matchedKeywordsForBest: string[] = [];

    for (const def of candidateDefinitions) {
      const defLower = def.toLowerCase();
      const matchedKeywords: string[] = [];
      let score = 0;

      // 1. Direct word overlap between context and definition
      for (const word of contextWords) {
        if (defLower.includes(word)) {
          score += 2.0;
          matchedKeywords.push(word);
        }
      }

      // 2. Domain keyword matching
      for (const [domain, keywords] of Object.entries(this.domainKeywords)) {
        const isContextInDomain = keywords.some(k => normalizedContext.includes(k));
        if (isContextInDomain) {
          for (const kw of keywords) {
            if (defLower.includes(kw)) {
              score += 1.0;
              if (!matchedKeywords.includes(kw)) {
                matchedKeywords.push(kw);
              }
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestDef = def;
        matchedKeywordsForBest = matchedKeywords;
      }
    }

    // Determine domain from context
    let detectedDomain = 'general';
    for (const [domain, keywords] of Object.entries(this.domainKeywords)) {
      if (keywords.some(k => normalizedContext.includes(k))) {
        detectedDomain = domain;
        break;
      }
    }

    const normalizedConfidence = bestScore > 0 ? Math.min(0.99, 0.7 + (bestScore * 0.05)) : 0.75;

    return {
      bestDefinition: bestDef,
      domain: detectedDomain,
      score: Number(normalizedConfidence.toFixed(2)),
      matchedKeywords: matchedKeywordsForBest
    };
  }
}
