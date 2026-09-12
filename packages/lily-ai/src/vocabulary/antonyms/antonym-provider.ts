import { KnowledgeSource } from '../../knowledge/knowledge-source.js';
import { KnowledgeQuery } from '../../knowledge/knowledge-context.js';
import { KnowledgeResult } from '../../knowledge/knowledge-result.js';
import { AntonymRegistry } from './antonym-registry.js';
import {
  AntonymEntry,
  AntonymLookupOptions,
  AntonymLookupResult,
  AntonymExpansionOptions,
  AntonymExpansionResult,
  ContradictionCheckResult
} from './antonym-entry.js';
import { AntonymLoader, DEFAULT_CORE_ANTONYMS } from './antonym-loader.js';
import { AntonymResolver } from './antonym-resolver.js';
import { AntonymSearch } from './antonym-search.js';
import { AntonymCache } from './antonym-cache.js';

export class AntonymKnowledgeProvider implements KnowledgeSource {
  // KnowledgeSource interface properties
  public id = 'antonym';
  public name = 'Antonym Intelligence Provider';
  public type = 'antonym';
  public priority = 60; // Authority: 60 (Taxonomy: 100 > Database: 85 > Handbook/Dictionary: 75 > Glossary: 65 > Synonym: 60 = Antonym: 60 > Vocabulary: 50)

  private registry: AntonymRegistry;
  private resolver: AntonymResolver;
  private searchEngine: AntonymSearch;
  private cache: AntonymCache;

  constructor(entries: AntonymEntry[] = DEFAULT_CORE_ANTONYMS) {
    this.registry = AntonymLoader.load(entries);
    this.cache = new AntonymCache();
    this.resolver = new AntonymResolver(this.registry);
    this.searchEngine = new AntonymSearch(this.registry);

    // Prewarm cache with core antonyms
    this.cache.prewarm(this.registry.entries());
  }

  public getRegistry(): AntonymRegistry {
    return this.registry;
  }

  public getResolver(): AntonymResolver {
    return this.resolver;
  }

  public getSearch(): AntonymSearch {
    return this.searchEngine;
  }

  public getCache(): AntonymCache {
    return this.cache;
  }

  /**
   * Looks up antonyms for a word with caching.
   */
  public lookup(word: string, options?: AntonymLookupOptions | string): AntonymLookupResult {
    const context = typeof options === 'string' ? options : options?.context;
    const cacheKey = `antonym:${(word || '').toLowerCase()}:${context || ''}`;

    const cached = this.cache.get<AntonymLookupResult>(cacheKey);
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
   * Finds antonym string array for a word.
   */
  public findAntonyms(word: string, options?: AntonymLookupOptions | string): string[] {
    return this.searchEngine.findAntonyms(word, options);
  }

  /**
   * Expands query terms into opposite variations.
   */
  public expandOpposites(query: string, options?: AntonymExpansionOptions): AntonymExpansionResult {
    return this.searchEngine.expandOpposites(query, options);
  }

  /**
   * Checks if word or antonym exists in the registry.
   */
  public exists(word: string, context?: string): boolean {
    return this.registry.has(word, context);
  }

  /**
   * Checks if two words are opposites.
   */
  public areOpposites(wordA: string, wordB: string, context?: string): boolean {
    return this.searchEngine.areOpposites(wordA, wordB, context);
  }

  /**
   * Checks for contradictions between two statements.
   */
  public checkContradiction(statementA: string, statementB: string, context?: string): ContradictionCheckResult {
    return this.searchEngine.checkContradiction(statementA, statementB, context);
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
        return lower === 'antonym' || lower === 'antonyms' || lower === 'opposite' || lower === 'opposites' || lower === 'contrast' || lower === 'vocabulary';
      });
      if (!allowed) {
        return results;
      }
    }

    const contextStr = query.context?.intent || query.context?.category || query.context?.domain;
    const lookupRes = this.lookup(rawTerm, contextStr);

    if (lookupRes.found && lookupRes.antonyms.length > 0) {
      results.push({
        source: this.id,
        authority: this.priority,
        content: {
          word: lookupRes.word,
          antonyms: lookupRes.antonyms,
          relations: lookupRes.relations,
          confidence: lookupRes.confidence,
          context: lookupRes.context
        },
        confidence: lookupRes.confidence,
        metadata: {
          word: lookupRes.word,
          category: 'Antonyms',
          type: 'antonym',
          antonymsCount: lookupRes.antonyms.length
        }
      });
    }

    return results;
  }
}
