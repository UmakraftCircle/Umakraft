import { Definition } from './definition-source.js';
import { DefinitionRegistry } from './definition-registry.js';

export interface SearchMatch {
  word: string;
  definition: Definition;
  score: number;
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'fulltext';
}

export class DefinitionSearch {
  private registry: DefinitionRegistry;

  constructor(registry: DefinitionRegistry) {
    this.registry = registry;
  }

  /**
   * Searches for definitions using exact, prefix, fuzzy, and fulltext algorithms.
   */
  public search(
    query: string,
    options?: {
      context?: string;
      source?: string;
      minConfidence?: number;
      limit?: number;
    }
  ): SearchMatch[] {
    const rawTerm = query.trim().toLowerCase();
    if (!rawTerm) return [];

    const limit = options?.limit || 10;
    const minConf = options?.minConfidence || 0.0;
    const targetCtx = options?.context?.toLowerCase();
    const targetSource = options?.source?.toLowerCase();

    const matches: SearchMatch[] = [];
    const seenWords = new Set<string>();

    const allDefinitions = this.registry.getAllDefinitions();

    for (const def of allDefinitions) {
      if (def.confidence < minConf) continue;
      if (targetSource && def.source.toLowerCase() !== targetSource) continue;

      const wordLower = def.word.toLowerCase();
      const defLower = def.definition.toLowerCase();
      const ctxLower = (def.context || '').toLowerCase();

      // Check context filter if specified
      if (targetCtx && ctxLower !== targetCtx && (!def.tags || !def.tags.some(t => t.toLowerCase() === targetCtx))) {
        // Context penalty or skip
      }

      let matchType: 'exact' | 'prefix' | 'fuzzy' | 'fulltext' | null = null;
      let score = 0;

      if (wordLower === rawTerm) {
        matchType = 'exact';
        score = 100 + def.authority * 0.2 + (ctxLower === targetCtx ? 20 : 0);
      } else if (wordLower.startsWith(rawTerm)) {
        matchType = 'prefix';
        score = 70 + (rawTerm.length / wordLower.length) * 20 + def.authority * 0.1;
      } else if (this.calculateLevenshtein(wordLower, rawTerm) <= 2 && rawTerm.length >= 4) {
        matchType = 'fuzzy';
        score = 50 + def.authority * 0.1;
      } else if (defLower.includes(rawTerm) || (def.examples && def.examples.some(e => e.toLowerCase().includes(rawTerm)))) {
        matchType = 'fulltext';
        score = 40 + (ctxLower === targetCtx ? 15 : 0) + def.authority * 0.1;
      }

      if (matchType) {
        matches.push({
          word: def.word,
          definition: def,
          score: Number(score.toFixed(2)),
          matchType
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return matches.slice(0, limit);
  }

  /**
   * Calculates Levenshtein distance for fuzzy matching.
   */
  private calculateLevenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
