import { DictionaryNormalizer } from '../dictionary/dictionary-normalizer.js';

export interface NormalizedAntonymTerm {
  original: string;
  normalized: string;
  lemma: string;
}

export class AntonymNormalizer {
  /**
   * Normalizes a word or phrase for antonym lookup.
   * Strips excess whitespace, punctuation, lowercases, and derives lemma.
   */
  public static normalize(input: string): NormalizedAntonymTerm {
    const raw = (input || '').trim().toLowerCase();
    const clean = raw.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();

    // Handle common verbal/adjectival negation constructions: "not met" -> "unmet", "not found" -> "missing"
    let candidate = clean;
    if (candidate.startsWith('not ')) {
      const rest = candidate.substring(4).trim();
      if (rest === 'met') candidate = 'unmet';
      else if (rest === 'valid') candidate = 'invalid';
      else if (rest === 'active') candidate = 'inactive';
      else if (rest === 'equal') candidate = 'unequal';
      else if (rest === 'complete') candidate = 'incomplete';
      else if (rest === 'available') candidate = 'unavailable';
    }

    // Use Dictionary morphological normalizer to obtain base lemma
    const dictNorm = DictionaryNormalizer.normalize(candidate);

    return {
      original: input,
      normalized: clean,
      lemma: dictNorm.normalized
    };
  }

  /**
   * Tokenizes text into normalized words for query expansion and opposition checks.
   */
  public static tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  /**
   * Extracts multi-word key phrases or predicates from statements.
   */
  public static extractPhrases(text: string): string[] {
    if (!text) return [];
    return text
      .split(/[.,;\n!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
