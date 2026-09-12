import {
  HandbookDocument,
  HandbookCategory,
  HandbookSearchOptions,
  HandbookSearchResult,
  HandbookRecommendationResult
} from './handbook-types.js';
import { HandbookRegistry } from './handbook-registry.js';
import { HandbookResolver } from './handbook-resolver.js';
import { HandbookRankingEngine } from './handbook-ranking.js';
import { HandbookCache } from './handbook-cache.js';
import { HandbookResult } from './handbook-result.js';
import { HandbookLoader } from './handbook-loader.js';

export class HandbookSearchEngine {
  private registry: HandbookRegistry;
  private resolver: HandbookResolver;
  private rankingEngine: HandbookRankingEngine;
  private cache: HandbookCache;

  constructor(
    registry?: HandbookRegistry,
    resolver?: HandbookResolver,
    rankingEngine?: HandbookRankingEngine,
    cache?: HandbookCache
  ) {
    this.registry = registry || new HandbookRegistry(HandbookLoader.load());
    this.resolver = resolver || new HandbookResolver();
    this.rankingEngine = rankingEngine || new HandbookRankingEngine();
    this.cache = cache || new HandbookCache();
  }

  public getRegistry(): HandbookRegistry {
    return this.registry;
  }

  public getCache(): HandbookCache {
    return this.cache;
  }

  /**
   * Main Search Method:
   * Searches handbook documents with semantic expansion and multi-factor ranking.
   */
  public search(
    rawQuery: string,
    options?: HandbookSearchOptions
  ): HandbookSearchResult[] {
    const query = rawQuery.trim();
    if (!query) return [];

    // Check cache
    const cached = this.cache.get(query, options?.category);
    if (cached) {
      return cached;
    }

    // 1. Semantic Query Resolution (Taxonomy + Lexical Intelligence)
    const semanticContext = this.resolver.resolve(query);

    // 2. Candidate Selection
    let candidates = this.registry.getAll();

    // Filter by Category
    if (options?.category) {
      const catLower = options.category.toLowerCase();
      candidates = candidates.filter(d => d.category.toLowerCase() === catLower);
    }

    // Filter Deprecated
    if (!options?.includeDeprecated) {
      candidates = candidates.filter(d => !d.deprecated);
    }

    // Filter by Required Tags
    if (options?.tags && options.tags.length > 0) {
      const requiredTags = options.tags.map(t => t.toLowerCase());
      candidates = candidates.filter(d =>
        d.tags.some(t => requiredTags.includes(t.toLowerCase()))
      );
    }

    // 3. Score and Rank candidates
    const scoredResults: HandbookSearchResult[] = [];

    for (const doc of candidates) {
      const ranked = this.rankingEngine.rank(doc, query, {
        taxonomyMatches: [
          ...semanticContext.taxonomyMatches,
          ...(options?.taxonomyContext || [])
        ],
        semanticTokens: semanticContext.semanticTokens,
        category: options?.category
      });

      if (ranked.score > 0) {
        if (!options?.minConfidence || ranked.confidence >= options.minConfidence) {
          scoredResults.push(ranked);
        }
      }
    }

    // Sort by score descending
    scoredResults.sort((a, b) => b.score - a.score);

    const limit = options?.limit || 10;
    const finalResults = scoredResults.slice(0, limit);

    // Store in cache
    this.cache.set(query, finalResults, options?.category);

    return finalResults;
  }

  /**
   * Finds documents matching query with optional category constraint.
   */
  public find(query: string, category?: HandbookCategory | string): HandbookSearchResult[] {
    return this.search(query, { category });
  }

  /**
   * Direct lookup by Document ID or exact Title.
   */
  public lookup(idOrTitle: string): HandbookDocument | undefined {
    const byId = this.registry.getDocument(idOrTitle);
    if (byId) return byId;

    return this.registry.getByTitle(idOrTitle);
  }

  /**
   * Generates actionable recommendations and primary guide for a training / context goal.
   */
  public recommend(context: {
    character?: string;
    runningStyle?: string;
    track?: string;
    goal?: string;
  }): HandbookRecommendationResult {
    const searchTerms = [
      context.character,
      context.runningStyle,
      context.track,
      context.goal
    ].filter(Boolean).join(' ');

    const results = this.search(searchTerms || 'recommendations', { limit: 5 });
    const primaryGuide = results[0]?.document;
    const relatedGuides = results.slice(1).map(r => r.document);

    const recommendations: string[] = [];
    if (primaryGuide?.recommendations) {
      recommendations.push(...primaryGuide.recommendations);
    }
    for (const rel of relatedGuides) {
      if (rel.recommendations) {
        recommendations.push(...rel.recommendations);
      }
    }

    return {
      primaryGuide,
      relatedGuides,
      recommendations: Array.from(new Set(recommendations)),
      confidence: results[0]?.confidence || 0.8
    };
  }
}

// Backwards-compatible standalone function for existing callers
let defaultSearchEngineInstance: HandbookSearchEngine | null = null;
function getDefaultEngine(): HandbookSearchEngine {
  if (!defaultSearchEngineInstance) {
    defaultSearchEngineInstance = new HandbookSearchEngine();
  }
  return defaultSearchEngineInstance;
}

export function searchHandbook(query: string): HandbookResult[] {
  const engine = getDefaultEngine();
  const results = engine.search(query);
  return results.map(r => ({
    section: r.document.category,
    title: r.document.title,
    content: r.document.content,
    confidence: r.confidence,
    category: r.document.category,
    tags: r.document.tags,
    version: r.document.version,
    recommendations: r.document.recommendations
  }));
}
