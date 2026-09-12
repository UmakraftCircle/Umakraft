import { KnowledgeSource } from '../knowledge/knowledge-source.js';
import { KnowledgeQuery } from '../knowledge/knowledge-context.js';
import { KnowledgeResult } from '../knowledge/knowledge-result.js';
import { VocabularyRegistry, VocabularyEntry } from './vocabulary-registry.js';
import { VocabularyLoader, DEFAULT_CORE_VOCABULARY } from './vocabulary-loader.js';
import { VocabularySearch, VocabularySearchOptions } from './vocabulary-search.js';
import { VocabularyNormalizer, NormalizedWordResult } from './vocabulary-normalizer.js';
import { VocabularyCache } from './vocabulary-cache.js';
import { VocabularyValidator, ValidationReport } from './vocabulary-validator.js';
import { VocabularyResult } from './vocabulary-result.js';

export class LilyVocabularyProvider implements KnowledgeSource {
  // KnowledgeSource interface properties
  public id = 'vocabulary';
  public name = 'Lily Vocabulary Provider';
  public type = 'vocabulary';
  public priority = 50; // Priority 50 (below Taxonomy at 100)

  private registry: VocabularyRegistry;
  private searchEngine: VocabularySearch;
  private cache: VocabularyCache;
  private validationReport: ValidationReport;

  constructor(entries: VocabularyEntry[] = DEFAULT_CORE_VOCABULARY) {
    this.registry = VocabularyLoader.load(entries);
    this.searchEngine = new VocabularySearch(this.registry);
    this.cache = new VocabularyCache();

    // Startup validation
    this.validationReport = VocabularyValidator.validate(this.registry);

    // Prewarm cache with popular words
    this.cache.prewarm(this.registry.getAll());
  }

  public getRegistry(): VocabularyRegistry {
    return this.registry;
  }

  public getSearch(): VocabularySearch {
    return this.searchEngine;
  }

  public getCache(): VocabularyCache {
    return this.cache;
  }

  public getValidationReport(): ValidationReport {
    return this.validationReport;
  }

  /**
   * Normalizes word casing, whitespace, and inflected forms (e.g. running -> run).
   */
  public normalize(word: string): NormalizedWordResult {
    return VocabularyNormalizer.normalize(word);
  }

  /**
   * Authoritative lookup of a word definition and part of speech.
   * Checks cache first, then searches registry with exact and normalized resolution.
   */
  public lookupWord(word: string): VocabularyResult | undefined {
    if (!word) return undefined;
    const clean = word.trim();
    if (!clean) return undefined;

    const cacheKey = `word:${clean.toLowerCase()}`;
    const cached = this.cache.get<VocabularyResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const found = this.searchEngine.findWord(clean);
    if (found) {
      this.cache.set(cacheKey, found);
      return found;
    }

    return undefined;
  }

  /**
   * Alias for lookupWord.
   */
  public findWord(word: string): VocabularyResult | undefined {
    return this.lookupWord(word);
  }

  /**
   * Searches vocabulary for matching words, aliases, and definitions.
   */
  public search(query: string, options?: VocabularySearchOptions): VocabularyResult[] {
    return this.searchEngine.search(query, options);
  }

  /**
   * Finds words starting with prefix.
   */
  public startsWith(prefix: string, limit?: number): VocabularyResult[] {
    return this.searchEngine.startsWith(prefix, limit);
  }

  /**
   * Finds words containing substring.
   */
  public contains(substring: string, limit?: number): VocabularyResult[] {
    return this.searchEngine.contains(substring, limit);
  }

  /**
   * Implements KnowledgeSource query interface for LilyKnowledgeService.
   */
  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = [];
    if (!query || !query.term) return results;

    const rawTerm = query.term.trim();
    if (!rawTerm) return results;

    // Filter by type if explicitly requested
    if (query.types && query.types.length > 0) {
      const allowed = query.types.some(t => {
        const lower = t.toLowerCase();
        return lower === 'vocabulary' || lower === 'word' || lower === 'definition' || lower === 'dictionary';
      });
      if (!allowed) {
        return results;
      }
    }

    // 1. Direct word lookup (exact, alias, or normalized lemma)
    const exactMatch = this.lookupWord(rawTerm);
    if (exactMatch) {
      results.push({
        source: this.id,
        authority: this.priority,
        content: {
          word: exactMatch.word,
          definition: exactMatch.definition,
          partOfSpeech: exactMatch.partOfSpeech,
          normalized: exactMatch.normalized,
          aliases: exactMatch.aliases,
          language: exactMatch.language,
          metadata: exactMatch.metadata
        },
        confidence: exactMatch.confidence,
        metadata: {
          word: exactMatch.word,
          partOfSpeech: exactMatch.partOfSpeech,
          category: 'Vocabulary',
          type: 'vocabulary',
          language: exactMatch.language || 'en'
        }
      });

      // If confidence is 1.0 or high, return top exact match directly
      if (exactMatch.confidence >= 0.95 && (!query.maxResults || query.maxResults <= 1)) {
        return results;
      }
    }

    // 2. Ranked vocabulary search
    const matches = this.search(rawTerm, {
      limit: query.maxResults ?? 5
    });

    for (const match of matches) {
      // Avoid duplicate of exact match
      if (exactMatch && match.word.toLowerCase() === exactMatch.word.toLowerCase()) {
        continue;
      }

      results.push({
        source: this.id,
        authority: this.priority,
        content: {
          word: match.word,
          definition: match.definition,
          partOfSpeech: match.partOfSpeech,
          aliases: match.aliases,
          language: match.language,
          metadata: match.metadata
        },
        confidence: match.confidence,
        metadata: {
          word: match.word,
          partOfSpeech: match.partOfSpeech,
          category: 'Vocabulary',
          type: 'vocabulary',
          language: match.language || 'en'
        }
      });
    }

    return results;
  }
}
