import { KnowledgeSource, KnowledgeSourceType } from '../knowledge-source.js';
import { KnowledgeQuery } from '../knowledge-context.js';
import { KnowledgeResult } from '../knowledge-result.js';

import { DatabaseRegistry, DatabaseRegistryOptions } from './database-registry.js';
import { DatabaseQueryEngine } from './database-query-engine.js';
import { DatabaseResolver } from './database-resolver.js';
import { DatabaseCache } from './database-cache.js';
import { DatabaseRankingEngine } from './database-ranking.js';
import { DatabaseValidator } from './database-validator.js';
import { DatabaseAuthorizationService } from './database-authorization.js';
import { DatabaseKnowledgeResult, DatabaseQueryOptions, UserSecurityContext } from './database-result.js';

import {
  TrainerEntity,
  ClubEntity,
  FanStatsEntity,
  LeaderboardEntryEntity,
  LinkRequestEntity,
  MilestoneDefinitionEntity
} from './repositories/repository-types.js';
import { MilestoneProgressResult } from './modules/milestone-module.js';

export interface DatabaseKnowledgeProviderConfig {
  registryOptions?: DatabaseRegistryOptions;
  cacheTtlMs?: number;
}

export class DatabaseKnowledgeProvider implements KnowledgeSource {
  public id: string = 'database_provider';
  public name: string = 'Database Knowledge Provider';
  public type: KnowledgeSourceType = 'database';
  public priority: number = 95; // Authority: 95 (Dynamic live data overrides static knowledge)

  private registry: DatabaseRegistry;
  private authService: DatabaseAuthorizationService;
  private queryEngine: DatabaseQueryEngine;
  private resolver: DatabaseResolver;
  private cache: DatabaseCache;
  private rankingEngine: DatabaseRankingEngine;
  private validator: DatabaseValidator;

  constructor(config: DatabaseKnowledgeProviderConfig = {}) {
    this.registry = new DatabaseRegistry(config.registryOptions);
    this.authService = new DatabaseAuthorizationService();
    this.queryEngine = new DatabaseQueryEngine(this.registry, this.authService);
    this.resolver = new DatabaseResolver(this.registry, this.queryEngine);
    this.cache = new DatabaseCache({ defaultTtlMs: config.cacheTtlMs });
    this.rankingEngine = new DatabaseRankingEngine();
    this.validator = new DatabaseValidator();
  }

  public getRegistry(): DatabaseRegistry {
    return this.registry;
  }

  public getAuth(): DatabaseAuthorizationService {
    return this.authService;
  }

  public getQueryEngine(): DatabaseQueryEngine {
    return this.queryEngine;
  }

  public getResolver(): DatabaseResolver {
    return this.resolver;
  }

  public getCache(): DatabaseCache {
    return this.cache;
  }

  public getRanking(): DatabaseRankingEngine {
    return this.rankingEngine;
  }

  public getValidator(): DatabaseValidator {
    return this.validator;
  }

  public getFanModule() {
    return this.registry.fanModule;
  }

  public getLeaderboardModule() {
    return this.registry.leaderboardModule;
  }

  public getLinkModule() {
    return this.registry.linkModule;
  }

  public getMilestoneModule() {
    return this.registry.milestoneModule;
  }

  public getClubModule() {
    return this.registry.clubModule;
  }

  // --- Core Public API ---

  public async getTrainer(trainerIdOrName: string, userContext?: UserSecurityContext): Promise<TrainerEntity | null> {
    if (!this.authService.canAccess('trainer', 'read', userContext, trainerIdOrName)) {
      return null;
    }
    return (
      (await this.registry.trainerRepo.findById(trainerIdOrName)) ||
      (await this.registry.trainerRepo.findByDiscordId(trainerIdOrName)) ||
      (await this.registry.trainerRepo.findByName(trainerIdOrName))
    );
  }

  public async getLeaderboard(limit: number = 10, userContext?: UserSecurityContext): Promise<LeaderboardEntryEntity[]> {
    if (!this.authService.canAccess('leaderboard', 'read', userContext)) {
      return [];
    }
    return this.registry.leaderboardModule.getLeaderboard(limit);
  }

  public async getFanStatistics(trainerIdOrName: string, userContext?: UserSecurityContext): Promise<FanStatsEntity | null> {
    if (!this.authService.canAccess('fan_gain', 'read', userContext, trainerIdOrName)) {
      return null;
    }
    return this.registry.fanModule.getFanStatistics(trainerIdOrName);
  }

  public async getMilestoneProgress(trainerIdOrFans: string | number, userContext?: UserSecurityContext): Promise<MilestoneProgressResult> {
    return this.registry.milestoneModule.getProgress(trainerIdOrFans);
  }

  public async getClubData(clubId?: string, userContext?: UserSecurityContext): Promise<ClubEntity> {
    return this.registry.clubModule.getClubData(clubId);
  }

  /**
   * Internal database query engine with caching, ranking, and validation.
   */
  public async queryDatabase(options: DatabaseQueryOptions): Promise<DatabaseKnowledgeResult[]> {
    const cacheKey = JSON.stringify({
      entityType: options.entityType,
      entityId: options.entityId,
      term: options.term,
      limit: options.limit
    });

    const userKey = options.userContext?.userId || options.userContext?.discordUserId || 'public';
    const cached = this.cache.get(cacheKey, userKey);
    if (cached) {
      return cached;
    }

    const rawResults = await this.queryEngine.execute(options);
    const validResults = rawResults.filter(r => this.validator.validateResult(r).valid);
    const ranked = this.rankingEngine.rank(validResults, options.term || options.entityId, options.entityType);

    this.cache.set(cacheKey, ranked, userKey);
    return ranked;
  }

  /**
   * Natural language query resolution.
   */
  public async resolve(input: string, userContext?: UserSecurityContext): Promise<DatabaseKnowledgeResult[]> {
    const cacheKey = `nl::${input.trim().toLowerCase()}`;
    const userKey = userContext?.userId || userContext?.discordUserId || 'public';

    const cached = this.cache.get(cacheKey, userKey);
    if (cached) {
      return cached;
    }

    const results = await this.resolver.resolve(input, userContext);
    const ranked = this.rankingEngine.rank(results, input);

    this.cache.set(cacheKey, ranked, userKey);
    return ranked;
  }

  /**
   * KnowledgeSource Interface implementation for KnowledgeEngine integration.
   * Authority: 95
   */
  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const term = query.term?.trim();
    if (!term) return [];

    const userContext: UserSecurityContext = {
      userId: query.context?.recentEntities?.[0],
      discordUserId: query.context?.recentEntities?.[0]
    };

    // Perform database resolution
    const dbResults = await this.resolve(term, userContext);

    // Map to standard KnowledgeResult format
    return dbResults.map(r => ({
      source: 'database',
      authority: this.priority,
      content: r.payload,
      confidence: r.confidence,
      metadata: {
        id: r.entityId,
        entityType: r.entityType,
        domain: 'Database Live Operations',
        ...(r.metadata || {})
      }
    }));
  }
}
