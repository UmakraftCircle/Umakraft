import { KnowledgeSource } from '../../knowledge/knowledge-source.js';
import { KnowledgeQuery } from '../../knowledge/knowledge-context.js';
import { KnowledgeResult } from '../../knowledge/knowledge-result.js';
import { SynonymRegistry } from './synonym-registry.js';
import { SynonymEntry, SynonymLookupOptions, SynonymLookupResult, SynonymExpansionOptions, SynonymExpansionResult } from './synonym-entry.js';
import { SynonymLoader, DEFAULT_CORE_SYNONYMS } from './synonym-loader.js';
import { SynonymResolver } from './synonym-resolver.js';
import { SynonymSearch } from './synonym-search.js';
import { SynonymCache } from './synonym-cache.js';

export class SynonymKnowledgeProvider implements KnowledgeSource {
  // KnowledgeSource interface properties
  public id = 'synonym';
  public name = 'Synonym Intelligence Provider';
  public type = 'synonym';
  public priority = 60; // Authority: 60 (Taxonomy: 100 > Database: 85 > Handbook/Dictionary: 75 > Glossary: 65 > Synonym: 60 > Vocabulary: 50)

  private registry: SynonymRegistry;
  private resolver: SynonymResolver;
  private searchEngine: SynonymSearch;
  private cache: SynonymCache;

  constructor(entries: SynonymEntry[] = DEFAULT_CORE_SYNONYMS) {
    this.registry = SynonymLoader.load(entries);
    this.cache = new SynonymCache();
    this.resolver = new SynonymResolver(this.registry);
    this.searchEngine = new SynonymSearch(this.registry);

    // Prewarm cache with core synonyms
    this.cache.prewarm(this.registry.entries());
  }

  public getRegistry(): SynonymRegistry {
    return this.registry;
  }

  public getResolver(): SynonymResolver {
    return this.resolver;
  }

  public getSearch(): SynonymSearch {
    return this.searchEngine;
  }

  public getCache(): SynonymCache {
    return this.cache;
  }

  /**
   * Looks up synonyms for a word with caching.
   */
  public lookup(word: string, options?: SynonymLookupOptions | string): SynonymLookupResult {
    const context = typeof options === 'string' ? options : options?.context;
    const cacheKey = `synonym:${(word || '').toLowerCase()}:${context || ''}`;

    const cached = this.cache.get<SynonymLookupResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = this.resolver.resolve(word, options);
    if (result.found) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Finds synonym string array for a word.
   */
  public findSynonyms(word: string, options?: SynonymLookupOptions | string): string[] {
    return this.searchEngine.findSynonyms(word, options);
  }

  /**
   * Expands query terms into synonymous variations.
   */
  public expand(query: string, options?: SynonymExpansionOptions): SynonymExpansionResult {
    return this.searchEngine.expand(query, options);
  }

  /**
   * Checks if word or synonym exists in the registry.
   */
  public exists(word: string, context?: string): boolean {
    return this.registry.has(word, context);
  }

  /**
   * Implements KnowledgeSource query interface for KnowledgeEngine & LilyKnowledgeService.
   */
  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = [];
    if (!query || !query.term) return results;

    const rawTerm = query.term.trim();
    if (!rawTerm) return results;

    // Filter by type if explicitly specified
    if (query.types && query.types.length > 0) {
      const allowed = query.types.some(t => {
        const lower = t.toLowerCase();
        return lower === 'synonym' || lower === 'synonyms' || lower === 'similar' || lower === 'related' || lower === 'vocabulary';
      });
      if (!allowed) {
        return results;
      }
    }

    const contextStr = query.context?.intent || query.context?.category || query.context?.domain;
    const lookupRes = this.lookup(rawTerm, contextStr);

    if (lookupRes.found && lookupRes.synonyms.length > 0) {
      results.push({
        source: this.id,
        authority: this.priority,
        content: {
          word: lookupRes.word,
          synonyms: lookupRes.synonyms,
          relations: lookupRes.relations,
          confidence: lookupRes.confidence,
          context: lookupRes.context
        },
        confidence: lookupRes.confidence,
        metadata: {
          word: lookupRes.word,
          category: 'Synonyms',
          type: 'synonym',
          synonymsCount: lookupRes.synonyms.length
        }
      });
    }

    return results;
  }
}
