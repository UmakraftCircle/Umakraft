import { DictionaryRegistry } from './dictionary-registry.js';
import { DictionaryCache } from './dictionary-cache.js';
import { DictionarySearch } from './dictionary-search.js';
import { DictionaryNormalizer } from './dictionary-normalizer.js';
import {
  DictionaryEntry,
  DictionaryLookupResult,
  DictionaryResolutionResult
} from './dictionary-entry.js';

export class DictionaryLookupEngine {
  private registry: DictionaryRegistry;
  private cache: DictionaryCache;
  private searchEngine: DictionarySearch;

  constructor(registry: DictionaryRegistry, cache?: DictionaryCache, searchEngine?: DictionarySearch) {
    this.registry = registry;
    this.cache = cache || new DictionaryCache();
    this.searchEngine = searchEngine || new DictionarySearch(this.registry);
  }

  /**
   * Checks if a word exists in the dictionary.
   */
  public exists(word: string): boolean {
    if (!word) return false;
    const clean = word.trim().toLowerCase();
    if (!clean) return false;

    if (this.cache.has(`exists:${clean}`)) {
      return this.cache.get<boolean>(`exists:${clean}`)!;
    }

    const hasWord = this.registry.has(clean);
    this.cache.set(`exists:${clean}`, hasWord);
    return hasWord;
  }

  /**
   * Finds the raw DictionaryEntry for a word, normalized lemma, or alias.
   */
  public find(word: string): DictionaryEntry | undefined {
    if (!word) return undefined;
    const clean = word.trim().toLowerCase();
    if (!clean) return undefined;

    const cacheKey = `entry:${clean}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get<DictionaryEntry>(cacheKey);
    }

    const entry = this.registry.get(clean);
    if (entry) {
      this.cache.set(cacheKey, entry);
    }
    return entry;
  }

  /**
   * Standard dictionary lookup with comprehensive result metadata and unknown word handling.
   */
  public lookup(word: string): DictionaryLookupResult {
    if (!word) {
      return {
        found: false,
        status: 'unknown_word',
        word: ''
      };
    }

    const rawWord = word.trim();
    const cleanLower = rawWord.toLowerCase();
    const normalizedRes = DictionaryNormalizer.normalize(cleanLower);

    const cacheKey = `lookup:${cleanLower}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get<DictionaryLookupResult>(cacheKey)!;
    }

    const entry = this.find(cleanLower);

    if (entry) {
      const success: DictionaryLookupResult = {
        found: true,
        entry,
        word: entry.word,
        normalized: entry.normalizedWord || normalizedRes.normalized,
        confidence: entry.confidence,
        definitions: entry.definitions,
        examples: entry.examples,
        partOfSpeech: entry.partOfSpeech
      };
      this.cache.set(cacheKey, success);
      return success;
    }

    // Unknown word handling (F14.10)
    const failure: DictionaryLookupResult = {
      found: false,
      status: 'unknown_word',
      word: rawWord,
      normalized: normalizedRes.normalized
    };
    this.cache.set(cacheKey, failure);
    return failure;
  }

  /**
   * Full morphological resolution & dictionary lookup.
   */
  public resolve(word: string): DictionaryResolutionResult {
    if (!word) {
      return {
        found: false,
        status: 'unknown_word',
        word: '',
        normalized: ''
      };
    }

    const rawWord = word.trim();
    const cleanLower = rawWord.toLowerCase();
    const norm = DictionaryNormalizer.normalize(cleanLower);

    const lookupRes = this.lookup(cleanLower);

    if (lookupRes.found) {
      return {
        found: true,
        word: lookupRes.word,
        normalized: lookupRes.normalized,
        entry: lookupRes.entry,
        definitions: lookupRes.definitions,
        examples: lookupRes.examples,
        partOfSpeech: lookupRes.partOfSpeech,
        confidence: lookupRes.confidence
      };
    }

    return {
      found: false,
      status: 'unknown_word',
      word: rawWord,
      normalized: norm.normalized
    };
  }
}
