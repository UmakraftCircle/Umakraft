import { FederationQuery, FederationContext, FederationContextBuilder } from './federation-context.js';
import {
  FederatedResult,
  KnowledgeProviderResult,
  ProviderError,
  ResponsePlan
} from './federation-result.js';
import {
  KnowledgeProvider,
  TaxonomyFederationAdapter,
  HandbookFederationAdapter,
  DatabaseFederationAdapter,
  LexicalFederationAdapter,
  MemoryFederationAdapter,
  FederationResolver
} from './federation-resolver.js';
import { FederationRouter, RoutePlan } from './federation-router.js';
import { FederationAggregator, ConflictRecord } from './federation-aggregator.js';
import { FederationConfidenceEngine } from './federation-confidence.js';
import { FederationCache } from './federation-cache.js';

import { TaxonomyKnowledgeProvider } from '../providers/taxonomy/taxonomy-provider.js';
import { HandbookKnowledgeProvider } from '../handbook/handbook-provider.js';
import { DatabaseKnowledgeProvider } from '../database/database-provider.js';
import { LilyLexicalIntelligence } from '../../language/lexical/lily-lexical-intelligence.js';

export interface FederationServiceOptions {
  enableCache?: boolean;
  cacheTtlMs?: number;
}

export class KnowledgeFederationService {
  private providers = new Map<string, KnowledgeProvider>();
  private router: FederationRouter;
  private cache: FederationCache;
  private enableCache: boolean;

  constructor(options: FederationServiceOptions = {}) {
    this.enableCache = options.enableCache ?? true;
    this.cache = new FederationCache({ defaultTtlMs: options.cacheTtlMs });
    this.router = new FederationRouter();

    this.registerDefaultProviders();
  }

  /**
   * Registers foundational system providers:
   * 1. Taxonomy Provider (Authority: 100)
   * 2. Database Provider (Authority: 95)
   * 3. Handbook Provider (Authority: 90)
   * 4. Lexical Intelligence (Authority: 80)
   * 5. Memory Adapter (Reserved for M1)
   */
  private registerDefaultProviders(): void {
    const taxonomy = new TaxonomyKnowledgeProvider();
    const database = new DatabaseKnowledgeProvider();
    const handbook = new HandbookKnowledgeProvider();
    const lexical = new LilyLexicalIntelligence();

    this.registerProvider(new TaxonomyFederationAdapter(taxonomy));
    this.registerProvider(new DatabaseFederationAdapter(database));
    this.registerProvider(new HandbookFederationAdapter(handbook));
    this.registerProvider(new LexicalFederationAdapter(lexical));
    this.registerProvider(new MemoryFederationAdapter());
  }

  public registerProvider(provider: KnowledgeProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): KnowledgeProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): KnowledgeProvider[] {
    return Array.from(this.providers.values());
  }

  public getRouter(): FederationRouter {
    return this.router;
  }

  public getCache(): FederationCache {
    return this.cache;
  }

  /**
   * Builds rich federation context from query and session metadata.
   */
  public buildContext(query: FederationQuery, existingContext?: Partial<FederationContext>): FederationContext {
    return FederationContextBuilder.build(query, existingContext);
  }

  /**
   * Determines participating providers for a query.
   */
  public route(query: FederationQuery | string, context?: FederationContext): RoutePlan {
    const normalizedQuery: FederationQuery = typeof query === 'string' ? { text: query } : query;
    const ctx = context || this.buildContext(normalizedQuery);
    const registeredIds = Array.from(this.providers.keys());

    return this.router.route(normalizedQuery.text, ctx, registeredIds);
  }

  /**
   * Aggregates multi-source provider results into unified federated result.
   */
  public aggregate(
    queryText: string,
    results: Record<string, KnowledgeProviderResult>,
    context: FederationContext,
    totalLatencyMs: number = 0,
    errors: ProviderError[] = []
  ): FederatedResult {
    const { sections, aggregatedData, conflicts, responsePlan } = FederationAggregator.aggregate(results, context);
    const confidenceAssessment = FederationConfidenceEngine.calculate(results);

    return {
      query: queryText,
      context,
      participatingProviders: Object.keys(results),
      providerResults: results,
      errors: errors.length > 0 ? errors : undefined,
      sections,
      aggregatedData,
      confidence: confidenceAssessment.overallConfidence,
      conflictsResolved: conflicts.length > 0 ? conflicts : undefined,
      responsePlan,
      totalLatencyMs,
      timestamp: new Date()
    };
  }

  /**
   * Main unified entry point: coordinates routing, concurrent execution, aggregation, conflict resolution, and response planning.
   */
  public async query(query: FederationQuery | string, contextOverride?: Partial<FederationContext>): Promise<FederatedResult> {
    const startTime = Date.now();
    const normalizedQuery: FederationQuery = typeof query === 'string' ? { text: query } : query;
    const context = this.buildContext(normalizedQuery, contextOverride);

    // 1. Check Federation Cache
    if (this.enableCache) {
      const cached = this.cache.get(normalizedQuery.text, normalizedQuery.userId, normalizedQuery.guildId);
      if (cached) {
        return cached;
      }
    }

    // 2. Determine Participating Providers via Router
    const routePlan = this.route(normalizedQuery, context);
    context.semanticExpansions = routePlan.semanticExpansions;

    // Filter providers that are registered and selected
    const selectedProviderInstances: KnowledgeProvider[] = [];
    for (const providerId of routePlan.selectedProviders) {
      const p = this.providers.get(providerId);
      if (p) selectedProviderInstances.push(p);
    }

    // If no provider selected, query all supported
    if (selectedProviderInstances.length === 0) {
      for (const p of this.providers.values()) {
        if (p.supports(normalizedQuery.text, context)) {
          selectedProviderInstances.push(p);
        }
      }
    }

    // 3. Concurrent Parallel Execution (F23.4)
    const { results, errors } = await FederationResolver.executeParallel(
      selectedProviderInstances,
      normalizedQuery.text,
      context
    );

    const totalLatencyMs = Date.now() - startTime;

    // 4. Aggregation & Response Planning (F23.5, F23.6, F23.7, F23.10)
    const federatedResult = this.aggregate(normalizedQuery.text, results, context, totalLatencyMs, errors);

    // 5. Store in Cache
    if (this.enableCache) {
      this.cache.set(normalizedQuery.text, federatedResult, normalizedQuery.userId, normalizedQuery.guildId);
    }

    return federatedResult;
  }

  /**
   * Alias for query().
   */
  public async resolve(query: FederationQuery | string, contextOverride?: Partial<FederationContext>): Promise<FederatedResult> {
    return this.query(query, contextOverride);
  }

  /**
   * Public API helper: getKnowledge()
   */
  public async getKnowledge(query: FederationQuery | string): Promise<FederatedResult> {
    return this.query(query);
  }
}
