import { KnowledgeEngine } from './knowledge-engine.js';
import { KnowledgeQuery, KnowledgeContext } from './knowledge-context.js';
import { KnowledgeResult } from './knowledge-result.js';
import { KnowledgeRegistry } from './knowledge-registry.js';
import { KnowledgeSource } from './knowledge-source.js';
import { KnowledgeFederationService } from './federation/knowledge-federation.js';
import { FederatedResult, FederationQuery } from './federation/index.js';

export class LilyKnowledgeService {
  private engine: KnowledgeEngine;
  private federation: KnowledgeFederationService;

  constructor(engine?: KnowledgeEngine, federation?: KnowledgeFederationService) {
    this.engine = engine || new KnowledgeEngine();
    this.federation = federation || new KnowledgeFederationService();
  }

  public getEngine(): KnowledgeEngine {
    return this.engine;
  }

  public getRegistry(): KnowledgeRegistry {
    return this.engine.getRegistry();
  }

  public getFederationService(): KnowledgeFederationService {
    return this.federation;
  }

  public registerSource(source: KnowledgeSource): void {
    this.engine.getRegistry().register(source);
  }

  /**
   * Main Public API:
   * resolve(query: KnowledgeQuery): Promise<KnowledgeResult[]>
   */
  public async resolve(query: KnowledgeQuery | string, context?: KnowledgeContext): Promise<KnowledgeResult[]> {
    const q: KnowledgeQuery = typeof query === 'string'
      ? { term: query, context }
      : query;

    return await this.engine.query(q);
  }

  /**
   * Query alias for resolve.
   */
  public async query(query: KnowledgeQuery | string, context?: KnowledgeContext): Promise<KnowledgeResult[]> {
    return this.resolve(query, context);
  }

  /**
   * High-level Federated Resolution API (F23 Knowledge Federation):
   * Dispatches queries through the Knowledge Federation Service to combine
   * Taxonomy, Handbook, Database, and Lexical Intelligence.
   */
  public async resolveFederated(query: FederationQuery | string): Promise<FederatedResult> {
    return await this.federation.query(query);
  }

  /**
   * Resolves knowledge based on LanguageCoreResult:
   * User Message -> LanguageCore -> Understanding -> Knowledge Query -> Knowledge Resolver -> Knowledge Ranking -> Knowledge Result
   */
  public async resolveFromLanguageCore(coreResult: {
    normalizedText: string;
    entities?: string[];
    understanding?: {
      goal?: string;
      possibleIntent?: string;
      context?: Record<string, unknown>;
    };
    detectedDomains?: string[];
  }): Promise<KnowledgeResult[]> {
    const term = (coreResult.entities && coreResult.entities.length > 0)
      ? coreResult.entities[0]
      : coreResult.normalizedText;

    const context: KnowledgeContext = {
      intent: coreResult.understanding?.possibleIntent,
      userGoal: coreResult.understanding?.goal,
      domain: coreResult.detectedDomains?.[0] || 'Umamusume',
      recentEntities: coreResult.entities
    };

    return await this.resolve({ term, context });
  }
}

