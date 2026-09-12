import { VocabularyRegistry, VocabularyEntry } from './vocabulary-registry.js';
import { VocabularyResult } from './vocabulary-result.js';
import { VocabularyNormalizer } from './vocabulary-normalizer.js';

export interface VocabularySearchOptions {
  limit?: number;
  partOfSpeech?: string;
  exactOnly?: boolean;
}

export class VocabularySearch {
  private registry: VocabularyRegistry;

  constructor(registry: VocabularyRegistry) {
    this.registry = registry;
  }

  /**
   * Finds a specific word with exact, alias, or lemmatized match.
   */
  public findWord(word: string): VocabularyResult | undefined {
    if (!word) return undefined;
    const clean = word.trim();
    if (!clean) return undefined;

    const lower = clean.toLowerCase();

    // 1. Direct exact lookup
    const direct = this.registry.get(clean);
    if (direct) {
      return {
        word: direct.word,
        definition: direct.definition,
        partOfSpeech: direct.partOfSpeech,
        confidence: 1.0,
        language: direct.language,
        aliases: direct.aliases,
        metadata: direct.metadata
      };
    }

    // 2. Alias match
    for (const entry of this.registry.getAll()) {
      if (entry.aliases) {
        for (const alias of entry.aliases) {
          if (alias.toLowerCase() === lower) {
            return {
              word: entry.word,
              definition: entry.definition,
              partOfSpeech: entry.partOfSpeech,
              confidence: 0.95,
              language: entry.language,
              aliases: entry.aliases,
              metadata: { ...entry.metadata, matchedAlias: alias }
            };
          }
        }
      }
    }

    // 3. Normalization / Lemmatization
    const lemmatized = VocabularyNormalizer.lemmatize(clean);
    if (lemmatized && lemmatized !== lower) {
      const lemmaEntry = this.registry.get(lemmatized);
      if (lemmaEntry) {
        return {
          word: lemmaEntry.word,
          definition: lemmaEntry.definition,
          partOfSpeech: lemmaEntry.partOfSpeech,
          confidence: 0.9,
          normalized: lemmatized,
          language: lemmaEntry.language,
          aliases: lemmaEntry.aliases,
          metadata: { ...lemmaEntry.metadata, originalWord: clean }
        };
      }
    }

    return undefined;
  }

  /**
   * Searches vocabulary for terms matching query across words, aliases, and definitions.
   */
  public search(query: string, options?: VocabularySearchOptions): VocabularyResult[] {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const limit = options?.limit ?? 10;
    const posFilter = options?.partOfSpeech ? options.partOfSpeech.trim().toLowerCase() : undefined;

    // Check exact first
    if (options?.exactOnly) {
      const match = this.findWord(q);
      if (match) {
        if (!posFilter || match.partOfSpeech.toLowerCase() === posFilter) {
          return [match];
        }
      }
      return [];
    }

    const scored: Array<{ result: VocabularyResult; score: number }> = [];
    const entries = posFilter ? this.registry.getByPartOfSpeech(posFilter) : this.registry.getAll();

    for (const entry of entries) {
      const wordLower = entry.word.toLowerCase();
      let score = 0;

      if (wordLower === q) {
        score = 100;
      } else if (entry.aliases && entry.aliases.some(a => a.toLowerCase() === q)) {
        score = 90;
      } else if (wordLower.startsWith(q)) {
        score = 80 - (wordLower.length - q.length);
      } else if (entry.aliases && entry.aliases.some(a => a.toLowerCase().startsWith(q))) {
        score = 70;
      } else if (wordLower.includes(q)) {
        score = 60;
      } else if (entry.aliases && entry.aliases.some(a => a.toLowerCase().includes(q))) {
        score = 50;
      } else if (entry.definition.toLowerCase().includes(q)) {
        score = 40;
      }

      if (score > 0) {
        scored.push({
          score,
          result: {
            word: entry.word,
            definition: entry.definition,
            partOfSpeech: entry.partOfSpeech,
            confidence: Math.min(1.0, score / 100),
            language: entry.language,
            aliases: entry.aliases,
            metadata: entry.metadata
          }
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.result);
  }

  /**
   * Finds words starting with the specified prefix.
   */
  public startsWith(prefix: string, limit: number = 10): VocabularyResult[] {
    if (!prefix || !prefix.trim()) return [];
    const p = prefix.trim().toLowerCase();

    const matches: VocabularyResult[] = [];
    for (const entry of this.registry.getAll()) {
      if (entry.word.toLowerCase().startsWith(p)) {
        matches.push({
          word: entry.word,
          definition: entry.definition,
          partOfSpeech: entry.partOfSpeech,
          confidence: 0.85,
          language: entry.language,
          aliases: entry.aliases,
          metadata: entry.metadata
        });
        if (matches.length >= limit) break;
      }
    }

    return matches;
  }

  /**
   * Finds words containing the specified substring.
   */
  public contains(substring: string, limit: number = 10): VocabularyResult[] {
    if (!substring || !substring.trim()) return [];
    const sub = substring.trim().toLowerCase();

    const matches: VocabularyResult[] = [];
    for (const entry of this.registry.getAll()) {
      if (entry.word.toLowerCase().includes(sub)) {
        matches.push({
          word: entry.word,
          definition: entry.definition,
          partOfSpeech: entry.partOfSpeech,
          confidence: 0.75,
          language: entry.language,
          aliases: entry.aliases,
          metadata: entry.metadata
        });
        if (matches.length >= limit) break;
      }
    }

    return matches;
  }
}
