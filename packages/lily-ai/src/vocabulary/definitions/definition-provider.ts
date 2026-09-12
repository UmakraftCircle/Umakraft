import { KnowledgeSource } from '../../knowledge/knowledge-source.js';
import { KnowledgeQuery } from '../../knowledge/knowledge-context.js';
import { KnowledgeResult } from '../../knowledge/knowledge-result.js';
import {
  Definition,
  DefinitionLookupOptions,
  DefinitionLookupResult,
  DEFINITION_SOURCES
} from './definition-source.js';
import { DefinitionRegistry } from './definition-registry.js';
import { DefinitionLoader, CORE_OFFLINE_DEFINITIONS } from './definition-loader.js';
import { DefinitionResolver } from './definition-resolver.js';
import { DefinitionSearch } from './definition-search.js';
import { DefinitionCache } from './definition-cache.js';

export class DefinitionKnowledgeProvider implements KnowledgeSource {
  // KnowledgeSource interface properties
  public id = 'definition';
  public name = 'Definition Knowledge Provider';
  public type = 'definition';
  public priority = 70; // Priority / Authority 70 (Taxonomy: 100 > Database: 85 > Dictionary: 75 > Definition: 70 > Glossary: 65 > Synonym: 60 = Antonym: 60 > Vocabulary: 50)

  private registry: DefinitionRegistry;
  private resolver: DefinitionResolver;
  private searchEngine: DefinitionSearch;
  private cache: DefinitionCache;

  constructor(entries: Definition[] = CORE_OFFLINE_DEFINITIONS) {
    this.registry = DefinitionLoader.load(entries);
    this.resolver = new DefinitionResolver(this.registry);
    this.searchEngine = new DefinitionSearch(this.registry);
    this.cache = new DefinitionCache(2000, 1000 * 60 * 60);

    // Prewarm cache with core definitions
    this.cache.prewarm(this.registry.getAllDefinitions());
  }

  public getRegistry(): DefinitionRegistry {
    return this.registry;
  }

  public getResolver(): DefinitionResolver {
    return this.resolver;
  }

  public getSearch(): DefinitionSearch {
    return this.searchEngine;
  }

  public getCache(): DefinitionCache {
    return this.cache;
  }

  /**
   * Looks up the best definition for a word with caching and contextual ranking.
   */
  public lookupDefinition(
    word: string,
    options?: DefinitionLookupOptions | string
  ): DefinitionLookupResult {
    const opts: DefinitionLookupOptions = typeof options === 'string'
      ? { context: options }
      : options || {};

    const rawWord = word.trim().toLowerCase();
    const cacheKey = `lookup:${rawWord}:${opts.context || 'general'}:${opts.query || ''}`;

    const cached = this.cache.get<DefinitionLookupResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = this.resolver.resolve(rawWord, opts);
    if (result.found) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Resolves a word's multi-definition candidates and ranks them.
   */
  public resolveDefinition(
    word: string,
    options?: DefinitionLookupOptions | string
  ): DefinitionLookupResult {
    return this.lookupDefinition(word, options);
  }

  /**
   * Finds all definition candidates for a word.
   */
  public findDefinitions(
    word: string,
    options?: DefinitionLookupOptions | string
  ): Definition[] {
    const result = this.lookupDefinition(word, options);
    return result.definitions;
  }

  /**
   * Checks if a word or specific context definition exists.
   */
  public exists(word: string, context?: string): boolean {
    return this.registry.has(word, context);
  }

  /**
   * Returns the single best definition string for a word.
   */
  public getBestDefinition(
    word: string,
    options?: DefinitionLookupOptions | string
  ): string | undefined {
    const result = this.lookupDefinition(word, options);
    return result.bestDefinition;
  }

  /**
   * KnowledgeSource interface query implementation.
   */
  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const rawTerm = query.term?.trim();
    if (!rawTerm) return [];

    const contextDomain = query.context?.domain || query.context?.category;
    const lookupResult = this.lookupDefinition(rawTerm, {
      context: contextDomain,
      query: query.term
    });

    if (!lookupResult.found || !lookupResult.selectedDefinition) {
      // Try full-text search fallback
      const searchMatches = this.searchEngine.search(rawTerm, {
        context: contextDomain,
        limit: query.maxResults || 3
      });

      if (searchMatches.length === 0) return [];

      return searchMatches.map(match => ({
        source: this.id,
        authority: this.priority,
        confidence: match.definition.confidence * 0.9,
        metadata: {
          category: 'definition',
          key: `definition:${match.word}`
        },
        content: {
          word: match.word,
          definition: match.definition.definition,
          allDefinitions: [match.definition],
          source: match.definition.source,
          context: match.definition.context,
          examples: match.definition.examples,
          synonyms: match.definition.synonyms,
          partOfSpeech: match.definition.partOfSpeech
        }
      }));
    }

    const selected = lookupResult.selectedDefinition;
    return [{
      source: this.id,
      authority: this.priority, // 70
      confidence: lookupResult.confidence,
      metadata: {
        category: 'definition',
        key: `definition:${lookupResult.word}`
      },
      content: {
        word: lookupResult.word,
        definition: selected.definition,
        allDefinitions: lookupResult.definitions,
        selectedDefinition: selected,
        source: selected.source,
        context: selected.context,
        examples: selected.examples,
        synonyms: selected.synonyms,
        partOfSpeech: selected.partOfSpeech,
        rankingReasons: lookupResult.rankingReasons
      }
    }];
  }
}

