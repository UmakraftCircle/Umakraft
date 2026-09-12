import { AntonymRegistry } from './antonym-registry.js';
import { AntonymLoader, DEFAULT_CORE_ANTONYMS } from './antonym-loader.js';
import { AntonymResolver } from './antonym-resolver.js';
import { AntonymSearch } from './antonym-search.js';
import { AntonymCache } from './antonym-cache.js';
import { AntonymKnowledgeProvider } from './antonym-provider.js';
import {
  AntonymEntry,
  AntonymLookupOptions,
  AntonymLookupResult,
  AntonymExpansionOptions,
  AntonymExpansionResult,
  ContradictionCheckResult
} from './antonym-entry.js';

export class LilyAntonymEngine {
  private registry: AntonymRegistry;
  private resolver: AntonymResolver;
  private searchEngine: AntonymSearch;
  private cache: AntonymCache;
  private provider: AntonymKnowledgeProvider;

  constructor(entries: AntonymEntry[] = DEFAULT_CORE_ANTONYMS) {
    this.provider = new AntonymKnowledgeProvider(entries);
    this.registry = this.provider.getRegistry();
    this.resolver = this.provider.getResolver();
    this.searchEngine = this.provider.getSearch();
    this.cache = this.provider.getCache();
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

  public getProvider(): AntonymKnowledgeProvider {
    return this.provider;
  }

  /**
   * Looks up antonyms for a word with structured metadata and caching.
   */
  public lookup(word: string, options?: AntonymLookupOptions | string): AntonymLookupResult {
    return this.provider.lookup(word, options);
  }

  /**
   * Finds a simple array of antonym strings for a word.
   */
  public findAntonyms(word: string, options?: AntonymLookupOptions | string): string[] {
    return this.provider.findAntonyms(word, options);
  }

  /**
   * Expands query strings or tokens into opposite variations.
   */
  public expandOpposites(query: string, options?: AntonymExpansionOptions): AntonymExpansionResult {
    return this.provider.expandOpposites(query, options);
  }

  /**
   * Resolves a word's antonym relationships using exact and morphological matching.
   */
  public resolve(word: string, options?: AntonymLookupOptions | string): AntonymLookupResult {
    return this.resolver.resolve(word, options);
  }

  /**
   * Checks if a word or antonym exists in the engine.
   */
  public exists(word: string, context?: string): boolean {
    return this.provider.exists(word, context);
  }

  /**
   * Checks if two words are opposites.
   */
  public areOpposites(wordA: string, wordB: string, context?: string): boolean {
    return this.provider.areOpposites(wordA, wordB, context);
  }

  /**
   * Checks for direct contradictions between two statements.
   */
  public checkContradiction(statementA: string, statementB: string, context?: string): ContradictionCheckResult {
    return this.provider.checkContradiction(statementA, statementB, context);
  }
}
