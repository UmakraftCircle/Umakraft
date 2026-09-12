import { KnowledgeSource } from '../../knowledge/knowledge-source.js';
import { KnowledgeQuery } from '../../knowledge/knowledge-context.js';
import { KnowledgeResult } from '../../knowledge/knowledge-result.js';
import { DictionaryRegistry } from './dictionary-registry.js';
import { DictionaryEntry, DictionaryLookupResult, DictionaryResolutionResult } from './dictionary-entry.js';
import { DictionaryLoader, DEFAULT_CORE_DICTIONARY } from './dictionary-loader.js';
import { DictionarySearch, DictionarySearchOptions, DictionarySearchResult } from './dictionary-search.js';
import { DictionaryLookupEngine } from './dictionary-lookup.js';
import { DictionaryNormalizer, NormalizedDictionaryResult } from './dictionary-normalizer.js';
import { DictionaryCache } from './dictionary-cache.js';
import { DictionaryValidator, DictionaryValidationReport } from './dictionary-validator.js';

export class DictionaryKnowledgeProvider implements KnowledgeSource {
  // KnowledgeSource interface properties
  public id = 'dictionary';
  public name = 'Dictionary Knowledge Provider';
  public type = 'dictionary';
  public priority = 75; // Priority / Authority 75 (Taxonomy: 100 > Database: 85 > Handbook/Dictionary: 75 > Glossary: 65 > Vocabulary: 50)

  private registry: DictionaryRegistry;
  private searchEngine: DictionarySearch;
  private cache: DictionaryCache;
  private lookupEngine: DictionaryLookupEngine;
  private validationReport: DictionaryValidationReport;

  constructor(entries: DictionaryEntry[] = DEFAULT_CORE_DICTIONARY) {
    this.registry = DictionaryLoader.load(entries);
    this.cache = new DictionaryCache();
    this.searchEngine = new DictionarySearch(this.registry);
    this.lookupEngine = new DictionaryLookupEngine(this.registry, this.cache, this.searchEngine);

    // Startup validation
    this.validationReport = DictionaryValidator.validate(this.registry);

    // Prewarm cache with all core dictionary entries
    this.cache.prewarm(this.registry.getAll());
  }

  public getRegistry(): DictionaryRegistry {
    return this.registry;
  }

  public getSearch(): DictionarySearch {
    return this.searchEngine;
  }

  public getCache(): DictionaryCache {
    return this.cache;
  }

  public getLookup(): DictionaryLookupEngine {
    return this.lookupEngine;
  }

  public getValidationReport(): DictionaryValidationReport {
    return this.validationReport;
  }

  /**
   * Normalizes word casing, whitespace, and morphological forms (e.g. running -> run, studies -> study, better -> good).
   */
  public normalize(word: string): NormalizedDictionaryResult {
    return DictionaryNormalizer.normalize(word);
  }

  /**
   * Checks if word or lemma exists in the dictionary.
   */
  public exists(word: string): boolean {
    return this.lookupEngine.exists(word);
  }

  /**
   * Primary lookup returning structured success or unknown word status.
   */
  public lookup(word: string): DictionaryLookupResult {
    return this.lookupEngine.lookup(word);
  }

  /**
   * Primary resolve returning full morphological resolution and dictionary metadata.
   */
  public resolve(word: string): DictionaryResolutionResult {
    return this.lookupEngine.resolve(word);
  }

  /**
   * Searches dictionary for matching entries with ranking.
   */
  public search(query: string, options?: DictionarySearchOptions): DictionarySearchResult[] {
    return this.searchEngine.search(query, options);
  }

  /**
   * Implements KnowledgeSource query interface for KnowledgeEngine & LilyKnowledgeService.
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
        return lower === 'dictionary' || lower === 'word' || lower === 'definition' || lower === 'meaning' || lower === 'vocabulary';
      });
      if (!allowed) {
        return results;
      }
    }

    // 1. Direct word lookup / morphological resolution
    const lookupRes = this.lookup(rawTerm);
    if (lookupRes.found) {
      results.push({
        source: this.id,
        authority: this.priority,
        content: {
          word: lookupRes.word,
          normalized: lookupRes.normalized,
          partOfSpeech: lookupRes.partOfSpeech,
          definitions: lookupRes.definitions,
          examples: lookupRes.examples,
          aliases: lookupRes.entry.aliases,
          confidence: lookupRes.confidence
        },
        confidence: lookupRes.confidence,
        metadata: {
          word: lookupRes.word,
          partOfSpeech: lookupRes.partOfSpeech,
          category: 'Dictionary',
          type: 'dictionary',
          definitionsCount: lookupRes.definitions.length
        }
      });

      // If top confidence match and maxResults <= 1, return directly
      if (lookupRes.confidence >= 0.95 && (!query.maxResults || query.maxResults <= 1)) {
        return results;
      }
    }

    // 2. Ranked search across dictionary entries
    const searchMatches = this.search(rawTerm, {
      limit: query.maxResults ?? 5
    });

    for (const match of searchMatches) {
      // Avoid duplicate of direct lookup result
      if (lookupRes.found && match.word.toLowerCase() === lookupRes.word.toLowerCase()) {
        continue;
      }

      results.push({
        source: this.id,
        authority: this.priority,
        content: {
          word: match.word,
          normalized: match.normalizedWord,
          partOfSpeech: match.partOfSpeech,
          definitions: match.definitions,
          examples: match.examples,
          aliases: match.aliases,
          confidence: match.confidence
        },
        confidence: match.confidence,
        metadata: {
          word: match.word,
          partOfSpeech: match.partOfSpeech,
          category: 'Dictionary',
          type: 'dictionary',
          definitionsCount: match.definitions.length
        }
      });
    }

    return results;
  }
}
