import { LexicalQuery } from './lexical-query.js';

export type LexicalRoute = 'phrase' | 'dictionary' | 'synonym' | 'antonym' | 'definition' | 'learning';

export interface RouteDecision {
  primaryRoute: LexicalRoute;
  fallbackRoutes: LexicalRoute[];
  isMultiWord: boolean;
  isIdiomOrPhrase: boolean;
  phraseMeaning?: string;
  confidence: number;
}

export class LexicalRouter {
  // Built-in repository of common idioms, figurative expressions, and domain phrases
  private idiomAndPhraseMap: Record<string, string> = {
    'break a leg': 'good luck',
    'piece of cake': 'something very easy to accomplish',
    'bite the bullet': 'face a difficult situation with courage',
    'hit the ground running': 'start something and proceed at a fast pace',
    'front runner': 'a competitor who leads the field or runs from the front',
    'pace setter': 'a runner who establishes the pace of a race',
    'last spurt': 'a sudden burst of acceleration during the final stretch of a race',
    'speed parent': 'a parent factor source prioritizing speed stat inheritance',
    'stamina parent': 'a parent factor source prioritizing stamina stat inheritance',
    'powerdrift': 'a tactical cornering maneuver maintaining high speed',
    'run out of steam': 'lose energy or momentum',
    'spurt late': 'accelerate forcefully near the finish line',
    'on the right track': 'proceeding in a good or correct direction',
    'in the home stretch': 'in the final phase or concluding portion of an effort'
  };

  /**
   * Evaluates query structure and determines the primary routing target.
   */
  public route(query: LexicalQuery | string): RouteDecision {
    const text = typeof query === 'string' ? query.trim() : query.text.trim();
    const normalized = text.toLowerCase();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const isMultiWord = tokens.length > 1;

    // 1. Check known idioms or multi-word phrase dictionary
    if (this.idiomAndPhraseMap[normalized]) {
      return {
        primaryRoute: 'phrase',
        fallbackRoutes: ['definition', 'dictionary'],
        isMultiWord: true,
        isIdiomOrPhrase: true,
        phraseMeaning: this.idiomAndPhraseMap[normalized],
        confidence: 0.95
      };
    }

    // 2. Check multi-word phrase
    if (isMultiWord) {
      return {
        primaryRoute: 'phrase',
        fallbackRoutes: ['dictionary', 'definition', 'learning'],
        isMultiWord: true,
        isIdiomOrPhrase: false,
        confidence: 0.88
      };
    }

    // 3. Single-word queries:
    // Determine route based on options or intent hints
    const opts = typeof query === 'object' ? query.options : undefined;
    if (opts?.includeSynonyms && !opts?.includeDefinitions) {
      return {
        primaryRoute: 'synonym',
        fallbackRoutes: ['dictionary', 'definition'],
        isMultiWord: false,
        isIdiomOrPhrase: false,
        confidence: 0.92
      };
    }

    if (opts?.includeAntonyms) {
      return {
        primaryRoute: 'antonym',
        fallbackRoutes: ['dictionary', 'definition'],
        isMultiWord: false,
        isIdiomOrPhrase: false,
        confidence: 0.90
      };
    }

    if (opts?.includeDefinitions) {
      return {
        primaryRoute: 'definition',
        fallbackRoutes: ['dictionary', 'synonym', 'learning'],
        isMultiWord: false,
        isIdiomOrPhrase: false,
        confidence: 0.94
      };
    }

    return {
      primaryRoute: 'dictionary',
      fallbackRoutes: ['definition', 'synonym', 'antonym', 'learning'],
      isMultiWord: false,
      isIdiomOrPhrase: false,
      confidence: 0.92
    };
  }

  /**
   * Returns known phrase meaning if present.
   */
  public getPhraseMeaning(phrase: string): string | undefined {
    return this.idiomAndPhraseMap[phrase.trim().toLowerCase()];
  }

  /**
   * Registers a custom idiom or domain phrase.
   */
  public registerPhrase(phrase: string, meaning: string): void {
    this.idiomAndPhraseMap[phrase.trim().toLowerCase()] = meaning;
  }
}
