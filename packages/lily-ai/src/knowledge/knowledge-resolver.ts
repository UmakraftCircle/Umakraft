import { KnowledgeRegistry } from './knowledge-registry.js';
import { KnowledgeRanking } from './knowledge-ranking.js';
import { KnowledgeQuery } from './knowledge-context.js';
import { KnowledgeResult } from './knowledge-result.js';

export class KnowledgeResolver {
  private registry: KnowledgeRegistry;
  private ranking: KnowledgeRanking;

  constructor(registry: KnowledgeRegistry, ranking: KnowledgeRanking) {
    this.registry = registry;
    this.ranking = ranking;
  }

  /**
   * Resolves a knowledge query across all registered sources and ranks results by authority & context.
   */
  public async resolve(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const sources = this.registry.getAll();
    if (sources.length === 0) return [];

    // Query all matching sources concurrently
    const queryPromises = sources.map(async (source) => {
      try {
        return await source.query(query);
      } catch (err) {
        return [] as KnowledgeResult[];
      }
    });

    const nestedResults = await Promise.all(queryPromises);
    const flattened = nestedResults.flat();

    // Rank results by authority hierarchy and context match
    const ranked = this.ranking.rank(flattened, query.context);

    // Apply maxResults limit if provided
    if (query.maxResults && query.maxResults > 0) {
      return ranked.slice(0, query.maxResults);
    }

    return ranked;
  }
}
