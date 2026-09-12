import { DatabaseRegistry } from './database-registry.js';
import { DatabaseKnowledgeResult, DatabaseQueryOptions } from './database-result.js';
import { DatabaseAuthorizationService } from './database-authorization.js';

export class DatabaseQueryEngine {
  private registry: DatabaseRegistry;
  private authService: DatabaseAuthorizationService;

  constructor(registry: DatabaseRegistry, authService: DatabaseAuthorizationService) {
    this.registry = registry;
    this.authService = authService;
  }

  public async execute(options: DatabaseQueryOptions): Promise<DatabaseKnowledgeResult[]> {
    const results: DatabaseKnowledgeResult[] = [];
    const entityType = options.entityType?.toLowerCase();
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    // Route query by entityType or discover dynamically
    if (!entityType || entityType === 'trainer' || entityType === 'member') {
      if (options.entityId || options.term) {
        const queryTerm = options.entityId || options.term!;
        const trainer = await this.registry.trainerRepo.findById(queryTerm) ||
                        await this.registry.trainerRepo.findByDiscordId(queryTerm) ||
                        await this.registry.trainerRepo.findByName(queryTerm);
        if (trainer) {
          results.push({
            source: 'database',
            entityType: 'trainer',
            entityId: trainer.trainerId,
            payload: trainer,
            confidence: 0.99,
            timestamp: new Date(),
            authority: 95,
            metadata: {
              trainerName: trainer.trainerName,
              linkedDiscordId: trainer.linkedDiscordId,
              clubName: trainer.clubName
            }
          });
        }
      } else if (entityType === 'trainer' || entityType === 'member') {
        const trainers = await this.registry.trainerRepo.findAll(limit, offset);
        for (const t of trainers) {
          results.push({
            source: 'database',
            entityType: 'trainer',
            entityId: t.trainerId,
            payload: t,
            confidence: 0.95,
            timestamp: new Date(),
            authority: 95,
            metadata: {
              trainerName: t.trainerName,
              clubName: t.clubName
            }
          });
        }
      }
    }

    if (!entityType || entityType === 'leaderboard' || entityType === 'ranking') {
      const isGeneralLbQuery = !options.entityId && (
        !options.term ||
        /leaderboard|ranking|standings|top\s*\d*|trainers|club/i.test(options.term)
      );

      if (!isGeneralLbQuery && (options.entityId || options.term)) {
        const term = options.entityId || options.term!;
        const rankEntry = await this.registry.leaderboardModule.getTrainerRank(term);
        if (rankEntry) {
          const nearby = await this.registry.leaderboardModule.getNearbyCompetitors(rankEntry.trainerId);
          results.push(this.registry.leaderboardModule.toRankKnowledgeResult(rankEntry, nearby));
        } else {
          const entries = await this.registry.leaderboardModule.getLeaderboard(limit, offset);
          results.push(this.registry.leaderboardModule.toLeaderboardKnowledgeResult(entries));
        }
      } else {
        const entries = await this.registry.leaderboardModule.getLeaderboard(limit, offset);
        results.push(this.registry.leaderboardModule.toLeaderboardKnowledgeResult(entries));
      }
    }

    if (!entityType || entityType === 'fan_gain' || entityType === 'fan_deficit' || entityType === 'fan_surplus') {
      if (options.entityId || options.term) {
        const term = options.entityId || options.term!;
        const stats = await this.registry.fanModule.getFanStatistics(term);
        if (stats) {
          results.push(await this.registry.fanModule.toKnowledgeResult(stats));
        }
      }
    }

    if (!entityType || entityType === 'milestone') {
      if (options.entityId || options.term) {
        const term = options.entityId || options.term!;
        const progress = await this.registry.milestoneModule.getProgress(term);
        results.push(this.registry.milestoneModule.toKnowledgeResult(progress, term));
      } else {
        const milestones = await this.registry.milestoneModule.getMilestones();
        results.push({
          source: 'database',
          entityType: 'milestone',
          entityId: 'all_milestones',
          payload: milestones,
          confidence: 1.0,
          timestamp: new Date(),
          authority: 95
        });
      }
    }

    if (!entityType || entityType === 'club') {
      const club = await this.registry.clubModule.getClubData(options.entityId || options.term);
      results.push(this.registry.clubModule.toKnowledgeResult(club));
    }

    if (!entityType || entityType === 'link_request') {
      if (options.entityId || options.term) {
        const req = await this.registry.linkModule.lookupRequest(options.entityId || options.term!);
        if (req) {
          results.push(this.registry.linkModule.toKnowledgeResult(req));
        }
      } else {
        const pending = await this.registry.linkModule.getPendingRequests(limit);
        for (const p of pending) {
          results.push(this.registry.linkModule.toKnowledgeResult(p));
        }
      }
    }

    // Apply filtering, sorting, pagination if specified in options.filters
    let filtered = results;
    if (options.filters) {
      filtered = results.filter(r => {
        const p = r.payload as Record<string, unknown>;
        for (const [k, v] of Object.entries(options.filters!)) {
          if (p && p[k] !== undefined && p[k] !== v) {
            return false;
          }
        }
        return true;
      });
    }

    // Filter through authorization service
    const authorized = this.authService.filterResults(filtered, options.userContext);

    // Sanitize payloads
    const sanitized = authorized.map(r => ({
      ...r,
      payload: this.authService.sanitizePayload(r.entityType, r.payload, options.userContext)
    }));

    return sanitized;
  }
}
