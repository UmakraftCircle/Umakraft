import { DictionaryRegistry } from './dictionary-registry.js';
import { DictionaryEntry } from './dictionary-entry.js';
import { DictionaryNormalizer } from './dictionary-normalizer.js';

export interface DictionarySearchOptions {
  limit?: number;
  partOfSpeech?: string;
  minConfidence?: number;
}

export interface DictionarySearchResult {
  entry: DictionaryEntry;
  word: string;
  normalizedWord: string;
  partOfSpeech: string;
  definitions: string[];
  examples?: string[];
  aliases?: string[];
  confidence: number;
  score: number;
}

export class DictionarySearch {
  private registry: DictionaryRegistry;

  constructor(registry: DictionaryRegistry) {
    this.registry = registry;
  }

  /**
   * Finds a word with exact match, normalized lemma, or alias.
   */
  public findWord(word: string): DictionaryEntry | undefined {
    return this.registry.get(word);
  }

  /**
   * Checks if word exists in registry.
   */
  public exists(word: string): boolean {
    return this.registry.has(word);
  }

  /**
   * Search dictionary entries with fuzzy query, alias, definition match and ranking.
   */
  public search(query: string, options: DictionarySearchOptions = {}): DictionarySearchResult[] {
    if (!query) return [];
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const limit = options.limit ?? 10;
    const minConfidence = options.minConfidence ?? 0.0;
    const filterPos = options.partOfSpeech ? options.partOfSpeech.trim().toLowerCase() : undefined;

    const normalizedQuery = DictionaryNormalizer.normalize(cleanQuery).normalized;
    const allEntries = this.registry.getAll();
    const scored: DictionarySearchResult[] = [];

    for (const entry of allEntries) {
      if (filterPos && entry.partOfSpeech.toLowerCase() !== filterPos) {
        continue;
      }
      if (entry.confidence < minConfidence) {
        continue;
      }

      let score = 0;
      const entryWord = entry.word.toLowerCase();
      const entryNorm = entry.normalizedWord ? entry.normalizedWord.toLowerCase() : entryWord;

      // 1. Exact word match
      if (entryWord === cleanQuery || entryNorm === cleanQuery) {
        score += 100;
      }
      // 2. Normalized lemma match
      else if (entryWord === normalizedQuery || entryNorm === normalizedQuery) {
        score += 90;
      }
      // 3. Alias exact match
      else if (entry.aliases && entry.aliases.some(a => a.toLowerCase() === cleanQuery || a.toLowerCase() === normalizedQuery)) {
        score += 80;
      }
      // 4. Prefix match
      else if (entryWord.startsWith(cleanQuery) || entryNorm.startsWith(cleanQuery)) {
        score += 60;
      }
      // 5. Substring word match
      else if (entryWord.includes(cleanQuery) || entryNorm.includes(cleanQuery)) {
        score += 40;
      }
      // 6. Definition text match
      else if (entry.definitions.some(d => d.toLowerCase().includes(cleanQuery))) {
        score += 20;
      }

      if (score > 0) {
        // Boost by confidence
        score = score * (entry.confidence || 1.0);
        scored.push({
          entry,
          word: entry.word,
          normalizedWord: entry.normalizedWord,
          partOfSpeech: entry.partOfSpeech,
          definitions: entry.definitions,
          examples: entry.examples,
          aliases: entry.aliases,
          confidence: entry.confidence,
          score
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }

  /**
   * Finds words starting with prefix.
   */
  public startsWith(prefix: string, limit: number = 10): DictionaryEntry[] {
    if (!prefix) return [];
    const clean = prefix.trim().toLowerCase();
    if (!clean) return [];

    const matches: DictionaryEntry[] = [];
    for (const entry of this.registry.getAll()) {
      if (entry.word.toLowerCase().startsWith(clean) || entry.normalizedWord.toLowerCase().startsWith(clean)) {
        matches.push(entry);
        if (matches.length >= limit) break;
      }
    }
    return matches;
  }

  /**
   * Finds words containing substring.
   */
  public contains(substring: string, limit: number = 10): DictionaryEntry[] {
    if (!substring) return [];
    const clean = substring.trim().toLowerCase();
    if (!clean) return [];

    const matches: DictionaryEntry[] = [];
    for (const entry of this.registry.getAll()) {
      if (entry.word.toLowerCase().includes(clean) || entry.normalizedWord.toLowerCase().includes(clean)) {
        matches.push(entry);
        if (matches.length >= limit) break;
      }
    }
    return matches;
  }
}
