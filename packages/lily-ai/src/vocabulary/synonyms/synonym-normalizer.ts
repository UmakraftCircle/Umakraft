import { DictionaryNormalizer } from '../dictionary/dictionary-normalizer.js';

export interface NormalizedSynonymTerm {
  original: string;
  normalized: string;
  lemma: string;
}

export class SynonymNormalizer {
  /**
   * Normalizes a word or phrase for synonym lookup.
   * Strips excess whitespace, punctuation, lowercases, and derives lemma.
   */
  public static normalize(input: string): NormalizedSynonymTerm {
    const raw = (input || '').trim().toLowerCase();
    const clean = raw.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();
    
    // Use Dictionary morphological normalizer to obtain base lemma
    const dictNorm = DictionaryNormalizer.normalize(clean);

    return {
      original: input,
      normalized: clean,
      lemma: dictNorm.normalized
    };
  }

  /**
   * Tokenizes text into normalized words for query expansion.
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
}
