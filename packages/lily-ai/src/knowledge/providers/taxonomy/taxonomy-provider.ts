import { KnowledgeSource } from '../../knowledge-source.js';
import { KnowledgeQuery } from '../../knowledge-context.js';
import { KnowledgeResult } from '../../knowledge-result.js';
import {
  TaxonomyLoader,
  TaxonomyRegistry,
  TaxonomyNode,
  DEFAULT_TAXONOMY_NODES
} from './taxonomy-loader.js';
import { TaxonomyIndex } from './taxonomy-index.js';
import { TaxonomySearch, TaxonomySearchOptions, TaxonomySearchResult } from './taxonomy-search.js';
import { TaxonomyAliasResolver, AliasResolutionResult } from './taxonomy-alias.js';
import { TaxonomyResolver, TaxonomyResolveContext, TaxonomyResolveResult } from './taxonomy-resolver.js';
import { TaxonomyValidator, ValidationReport } from './taxonomy-validator.js';
import { TaxonomyCache } from './taxonomy-cache.js';
import { TaxonomyNormalizer } from './taxonomy-normalizer.js';

export class TaxonomyKnowledgeProvider implements KnowledgeSource {
  // KnowledgeSource interface properties
  public id = 'taxonomy';
  public name = 'Official Taxonomy';
  public type = 'taxonomy';
  public priority = 100; // Highest authority (100)

  private registry: TaxonomyRegistry;
  private index: TaxonomyIndex;
  private searchEngine: TaxonomySearch;
  private aliasResolver: TaxonomyAliasResolver;
  private ambiguityResolver: TaxonomyResolver;
  private cache: TaxonomyCache;
  private validationReport: ValidationReport;

  constructor(nodes: TaxonomyNode[] = DEFAULT_TAXONOMY_NODES) {
    this.registry = TaxonomyLoader.load(nodes);
    this.index = new TaxonomyIndex(this.registry);
    this.searchEngine = new TaxonomySearch(this.index);
    this.aliasResolver = new TaxonomyAliasResolver(this.index);
    this.ambiguityResolver = new TaxonomyResolver(this.searchEngine, this.aliasResolver);
    this.cache = new TaxonomyCache();

    // Run startup validation
    this.validationReport = TaxonomyValidator.validate(this.registry);

    // Prewarm cache with popular and foundational taxonomy nodes
    this.cache.prewarm(this.registry.getAll());
  }

  public getRegistry(): TaxonomyRegistry {
    return this.registry;
  }

  public getIndex(): TaxonomyIndex {
    return this.index;
  }

  public getSearch(): TaxonomySearch {
    return this.searchEngine;
  }

  public getCache(): TaxonomyCache {
    return this.cache;
  }

  public getValidationReport(): ValidationReport {
    return this.validationReport;
  }

  /**
   * Finds a taxonomy node by exact ID.
   * Example: 'running_style.front_runner'
   */
  public findById(id: string): TaxonomyNode | undefined {
    const cached = this.cache.get<TaxonomyNode>(`id:${id}`);
    if (cached) return cached;

    const node = this.searchEngine.findById(id);
    if (node) {
      this.cache.set(`id:${id}`, node);
    }
    return node;
  }

  /**
   * Finds a taxonomy node by official name (case-insensitive).
   * Example: 'Front Runner'
   */
  public findByName(name: string): TaxonomyNode | undefined {
    const cached = this.cache.get<TaxonomyNode>(`name:${name}`);
    if (cached) return cached;

    const node = this.searchEngine.findByName(name);
    if (node) {
      this.cache.set(`name:${name}`, node);
    }
    return node;
  }

  /**
   * Finds a taxonomy node by alias.
   * Example: 'nige' -> Front Runner node
   */
  public findByAlias(alias: string): TaxonomyNode | undefined {
    const cached = this.cache.get<TaxonomyNode>(`alias:${alias}`);
    if (cached) return cached;

    const node = this.searchEngine.findByAlias(alias);
    if (node) {
      this.cache.set(`alias:${alias}`, node);
    }
    return node;
  }

  /**
   * Finds all taxonomy nodes belonging to a category.
   * Example: 'Running Style' -> [Front Runner, Pace Chaser, Late Surger, End Closer]
   */
  public findByCategory(category: string): TaxonomyNode[] {
    return this.searchEngine.findByCategory(category);
  }

  /**
   * Comprehensive search with ranking across ID, official name, aliases, and partial matches.
   */
  public search(query: string, options?: TaxonomySearchOptions): TaxonomySearchResult[] {
    return this.searchEngine.search(query, options);
  }

  /**
   * Resolves ambiguity and converts user input into a definitive taxonomy node or clarification matches.
   * Example 1: 'Front Runner' -> { id: 'running_style.front_runner', category: 'Running Style', officialName: 'Front Runner', ambiguous: false }
   * Example 2: 'rudolf' -> { ambiguous: true, matches: ['Symboli Rudolf', 'Rudolf Event'] }
   */
  public resolve(input: string, context?: TaxonomyResolveContext): TaxonomyResolveResult {
    return this.ambiguityResolver.resolve(input, context);
  }

  /**
   * Resolves an alias to its official canonical name.
   * Official name always wins!
   * Example 1: 'nige' -> { officialName: 'Front Runner' }
   * Example 2: 'senkou' -> { officialName: 'Pace Chaser' }
   */
  public resolveAlias(term: string): { officialName: string; node?: TaxonomyNode; category?: string } | undefined {
    const res = this.aliasResolver.resolve(term);
    if (!res) return undefined;
    return {
      officialName: res.officialName,
      node: res.node,
      category: res.category
    };
  }

  /**
   * KnowledgeSource interface query implementation.
   * Connects TaxonomyKnowledgeProvider directly to LilyKnowledgeService with Authority: 100.
   */
  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const rawTerm = query.term?.trim();
    if (!rawTerm) return [];

    const results: KnowledgeResult[] = [];

    // Check if category context is provided
    const categoryContext = query.context?.category;

    // First try alias/official resolution
    const resolved = this.resolve(rawTerm, {
      category: categoryContext,
      intent: query.context?.intent
    });

    if (!resolved.ambiguous && resolved.node) {
      const nodeType = resolved.node.category.toLowerCase().replace(/\s+/g, '_');
      results.push({
        source: this.id,
        authority: this.priority,
        content: {
          id: resolved.node.id,
          name: resolved.node.name,
          canonical: resolved.node.name,
          category: resolved.node.category,
          type: nodeType,
          aliases: resolved.node.aliases,
          metadata: resolved.node.metadata
        },
        confidence: 1.0,
        metadata: {
          id: resolved.node.id,
          name: resolved.node.name,
          canonical: resolved.node.name,
          category: resolved.node.category,
          type: nodeType,
          domain: 'Umamusume'
        }
      });
      return results;
    }

    // Otherwise run ranked search
    const searchMatches = this.search(rawTerm, {
      category: categoryContext,
      limit: query.maxResults ?? 5
    });

    for (const match of searchMatches) {
      const matchType = match.node.category.toLowerCase().replace(/\s+/g, '_');
      results.push({
        source: this.id,
        authority: this.priority,
        content: {
          id: match.node.id,
          name: match.node.name,
          canonical: match.node.name,
          category: match.node.category,
          type: matchType,
          aliases: match.node.aliases,
          metadata: match.node.metadata
        },
        confidence: match.score,
        metadata: {
          id: match.node.id,
          name: match.node.name,
          canonical: match.node.name,
          category: match.node.category,
          type: matchType,
          domain: 'Umamusume'
        }
      });
    }

    return results;
  }
}
