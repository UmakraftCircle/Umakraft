import { SynonymRegistry } from './synonym-registry.js';
import { SynonymLoader, DEFAULT_CORE_SYNONYMS } from './synonym-loader.js';
import { SynonymResolver } from './synonym-resolver.js';
import { SynonymSearch } from './synonym-search.js';
import { SynonymCache } from './synonym-cache.js';
import { SynonymKnowledgeProvider } from './synonym-provider.js';
import {
  SynonymEntry,
  SynonymLookupOptions,
  SynonymLookupResult,
  SynonymExpansionOptions,
  SynonymExpansionResult
} from './synonym-entry.js';

export class LilySynonymEngine {
  private registry: SynonymRegistry;
  private resolver: SynonymResolver;
  private searchEngine: SynonymSearch;
  private cache: SynonymCache;
  private provider: SynonymKnowledgeProvider;

  constructor(entries: SynonymEntry[] = DEFAULT_CORE_SYNONYMS) {
    this.provider = new SynonymKnowledgeProvider(entries);
    this.registry = this.provider.getRegistry();
    this.resolver = this.provider.getResolver();
    this.searchEngine = this.provider.getSearch();
    this.cache = this.provider.getCache();
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

  public getProvider(): SynonymKnowledgeProvider {
    return this.provider;
  }

  /**
   * Looks up synonyms for a word with structured metadata and caching.
   */
  public lookup(word: string, options?: SynonymLookupOptions | string): SynonymLookupResult {
    return this.provider.lookup(word, options);
  }

  /**
   * Finds a simple array of synonym strings for a word.
   */
  public findSynonyms(word: string, options?: SynonymLookupOptions | string): string[] {
    return this.provider.findSynonyms(word, options);
  }

  /**
   * Expands query strings or tokens into synonymous search variants.
   */
  public expand(query: string, options?: SynonymExpansionOptions): SynonymExpansionResult {
    return this.provider.expand(query, options);
  }

  /**
   * Resolves a word's synonym relationships using exact and morphological matching.
   */
  public resolve(word: string, options?: SynonymLookupOptions | string): SynonymLookupResult {
    return this.resolver.resolve(word, options);
  }

  /**
   * Checks if a word or synonym exists in the engine.
   */
  public exists(word: string, context?: string): boolean {
    return this.provider.exists(word, context);
  }
}
