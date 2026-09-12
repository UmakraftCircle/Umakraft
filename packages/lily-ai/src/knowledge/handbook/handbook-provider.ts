import { KnowledgeSource } from '../knowledge-source.js';
import { KnowledgeQuery } from '../knowledge-context.js';
import { KnowledgeResult } from '../knowledge-result.js';
import {
  HandbookDocument,
  HandbookCategory,
  HandbookSearchOptions,
  HandbookSearchResult,
  HandbookRecommendationResult
} from './handbook-types.js';
import { HandbookRegistry } from './handbook-registry.js';
import { HandbookLoader, CORE_HANDBOOK_DOCUMENTS } from './handbook-loader.js';
import { HandbookSearchEngine } from './handbook-search.js';
import { HandbookResolver } from './handbook-resolver.js';
import { HandbookRankingEngine } from './handbook-ranking.js';
import { HandbookCache } from './handbook-cache.js';

export class HandbookKnowledgeProvider implements KnowledgeSource {
  // KnowledgeSource interface properties
  public id = 'handbook';
  public name = 'Handbook Knowledge Provider';
  public type = 'handbook';
  public priority = 90; // Authority: 90 (Taxonomy: 100 > Handbook: 90 > Database: 85 > Lexical: 80 > Dictionary: 75 > Definition: 70)

  private registry: HandbookRegistry;
  private searchEngine: HandbookSearchEngine;
  private resolver: HandbookResolver;
  private rankingEngine: HandbookRankingEngine;
  private cache: HandbookCache;

  constructor(documents: HandbookDocument[] = CORE_HANDBOOK_DOCUMENTS) {
    this.registry = new HandbookRegistry(HandbookLoader.load(documents));
    this.resolver = new HandbookResolver();
    this.rankingEngine = new HandbookRankingEngine();
    this.cache = new HandbookCache();
    this.searchEngine = new HandbookSearchEngine(
      this.registry,
      this.resolver,
      this.rankingEngine,
      this.cache
    );
  }

  public getRegistry(): HandbookRegistry {
    return this.registry;
  }

  public getSearchEngine(): HandbookSearchEngine {
    return this.searchEngine;
  }

  public getResolver(): HandbookResolver {
    return this.resolver;
  }

  public getRankingEngine(): HandbookRankingEngine {
    return this.rankingEngine;
  }

  public getCache(): HandbookCache {
    return this.cache;
  }

  /**
   * Main Search API:
   * Searches handbook guides by keyword, topic, or query options.
   */
  public search(
    query: string,
    options?: HandbookSearchOptions
  ): HandbookSearchResult[] {
    return this.searchEngine.search(query, options);
  }

  /**
   * Lookups a specific document by its ID or title.
   */
  public lookup(idOrTitle: string): HandbookDocument | undefined {
    return this.searchEngine.lookup(idOrTitle);
  }

  /**
   * Finds the best matching guide for a given topic or entity.
   */
  public findGuide(
    topicOrEntity: string,
    category?: HandbookCategory | string
  ): HandbookDocument | undefined {
    const results = this.searchEngine.find(topicOrEntity, category);
    return results[0]?.document;
  }

  /**
   * Provides contextual build, training, or race recommendations.
   */
  public recommend(context: {
    character?: string;
    runningStyle?: string;
    track?: string;
    goal?: string;
  }): HandbookRecommendationResult {
    return this.searchEngine.recommend(context);
  }

  /**
   * Retrieves related guides for a given document ID.
   */
  public getRelatedDocuments(docId: string): HandbookDocument[] {
    return this.registry.getRelatedDocuments(docId);
  }

  /**
   * KnowledgeSource interface implementation for KnowledgeEngine resolution (Authority: 90).
   */
  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const term = query.term.trim();
    if (!term) return [];

    const domain = query.context?.domain;
    const category = query.context?.intent === 'build_guide' ? 'Characters' : undefined;

    const results = this.search(term, {
      category,
      minConfidence: 0.25,
      limit: 5
    });

    return results.map(r => ({
      source: this.id,
      authority: this.priority,
      content: {
        id: r.document.id,
        title: r.document.title,
        category: r.document.category,
        content: r.document.content,
        recommendations: r.document.recommendations,
        version: r.document.version,
        updatedAt: r.document.updatedAt
      },
      confidence: r.confidence,
      metadata: {
        tags: r.document.tags,
        matchedTags: r.matchedTags,
        matchReasons: r.matchReasons,
        source: r.document.source,
        domain: domain || 'Umamusume'
      }
    }));
  }
}
