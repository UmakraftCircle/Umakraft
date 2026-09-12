import { FederationContext } from './federation-context.js';
import { KnowledgeProviderResult, ProviderError } from './federation-result.js';

export interface KnowledgeProvider {
  id: string;
  authority: number;
  supports(query: string, context?: FederationContext): boolean;
  search(query: string, options?: any): Promise<any> | any;
  resolve(query: string, context?: any): Promise<any> | any;
}

/**
 * Adapter for Taxonomy Knowledge Provider
 */
export class TaxonomyFederationAdapter implements KnowledgeProvider {
  public id = 'taxonomy';
  public authority = 100;

  constructor(public source: any) {}

  public supports(query: string, context?: FederationContext): boolean {
    const lower = query.toLowerCase();
    return (
      context?.runningStyle !== undefined ||
      context?.character !== undefined ||
      /front runner|pace chaser|late surger|end closer|nige|senkou|sashi|oikomi|turf|dirt|sprint|mile|medium|long|skill|aptitude|stat/i.test(lower)
    );
  }

  public async search(query: string, options?: any): Promise<any> {
    if (typeof this.source.search === 'function') {
      return this.source.search(query, options);
    }
    return [];
  }

  public async resolve(query: string, context?: any): Promise<any> {
    if (typeof this.source.resolve === 'function') {
      const res = this.source.resolve(query, context);
      if (res && res.node) {
        return {
          id: res.node.id,
          name: res.node.name,
          category: res.node.category,
          canonical: res.node.name,
          primaryEntity: res.node.name,
          nodes: [res.node],
          aliases: res.node.aliases
        };
      }
      return res;
    }

    if (typeof this.source.query === 'function') {
      const qRes = await this.source.query({ term: query, context });
      if (qRes && qRes[0]) {
        return qRes[0].content;
      }
    }
    return null;
  }
}

/**
 * Adapter for Handbook Knowledge Provider
 */
export class HandbookFederationAdapter implements KnowledgeProvider {
  public id = 'handbook';
  public authority = 90;

  constructor(public source: any) {}

  public supports(query: string, context?: FederationContext): boolean {
    const lower = query.toLowerCase();
    return (
      context?.intent === 'build_guide' ||
      /guide|build|deck|strategy|recommend|tip|training|inheritance|speed|stamina|power|guts|wisdom/i.test(lower) ||
      (context?.runningStyle !== undefined && (lower.includes('build') || lower.includes('doing') || lower.includes('guide')))
    );
  }

  public async search(query: string, options?: any): Promise<any> {
    if (typeof this.source.search === 'function') {
      return this.source.search(query, options);
    }
    return [];
  }

  public async resolve(query: string, context?: any): Promise<any> {
    if (typeof this.source.recommend === 'function' && (context?.runningStyle || context?.character)) {
      const rec = this.source.recommend({
        runningStyle: context?.runningStyle,
        character: context?.character,
        goal: context?.userGoal
      });
      if (rec && rec.recommendation) {
        return {
          guides: [rec.matchedGuide],
          primaryRecommendation: rec.recommendation.summary || rec.recommendation.details?.[0],
          suggestedBuild: rec.recommendation.deckFocus?.join(', ')
        };
      }
    }

    if (typeof this.source.findGuide === 'function') {
      const guide = this.source.findGuide(query, context?.category);
      if (guide) {
        return {
          guides: [guide],
          primaryRecommendation: guide.recommendations?.[0] || guide.content?.slice(0, 150),
          suggestedBuild: guide.tags?.join(', ')
        };
      }
    }

    if (typeof this.source.search === 'function') {
      const searchRes = this.source.search(query, { limit: 3 });
      if (searchRes && searchRes.length > 0) {
        const top = searchRes[0];
        return {
          guides: searchRes.map((s: any) => s.document),
          primaryRecommendation: top.document?.recommendations?.[0] || top.document?.content?.slice(0, 150),
          suggestedBuild: top.document?.tags?.join(', ')
        };
      }
    }

    return null;
  }
}

/**
 * Adapter for Database Knowledge Provider
 */
export class DatabaseFederationAdapter implements KnowledgeProvider {
  public id = 'database';
  public authority = 95;

  constructor(public source: any) {}

  public supports(query: string, context?: FederationContext): boolean {
    const lower = query.toLowerCase();
    return (
      context?.trainerId !== undefined ||
      context?.intent === 'leaderboard' ||
      context?.intent === 'fan_progress' ||
      context?.intent === 'milestone_check' ||
      /rank|leaderboard|fan|gain|deficit|surplus|milestone|eligible|150m|200m|300m|club|umakraft|how am i doing|who.*leading/i.test(lower)
    );
  }

  public async search(query: string, options?: any): Promise<any> {
    if (typeof this.source.query === 'function') {
      return this.source.query({ term: query, context: options });
    }
    return [];
  }

  public async resolve(query: string, context?: any): Promise<any> {
    const trainerId = context?.trainerId || context?.userId;
    const lower = query.toLowerCase();

    // If resolving live trainer/fan composite query
    if (typeof this.source.getCompositeTrainerStatus === 'function' && trainerId) {
      try {
        const composite = await this.source.getCompositeTrainerStatus(trainerId);
        if (composite) {
          return {
            trainer: composite.trainer,
            fanStats: composite.fanStats,
            leaderboard: composite.leaderboard,
            milestoneProgress: composite.milestoneProgress
          };
        }
      } catch {
        // Continue to direct resolution
      }
    }

    // Direct resolve
    if (typeof this.source.resolve === 'function') {
      const res = await this.source.resolve(query, context?.userSecurityContext || { userId: trainerId, roles: ['member'] });
      if (res && res.data) {
        return res.data;
      }
    }

    // Direct fallback lookups for leaderboard / stats
    if (lower.includes('leading') || lower.includes('rank 1') || lower.includes('top position') || lower.includes('leaderboard')) {
      if (typeof this.source.getLeaderboard === 'function') {
        const lb = await this.source.getLeaderboard(10);
        return {
          leaderboard: lb[0] ? { rank: 1, trainerName: lb[0].trainerName, fans: lb[0].fans } : undefined,
          topRankings: lb
        };
      }
    }

    if (trainerId && typeof this.source.getTrainer === 'function') {
      const trainer = await this.source.getTrainer(trainerId);
      const fanStats = typeof this.source.getFanStatistics === 'function' ? await this.source.getFanStatistics(trainerId) : undefined;
      const lb = typeof this.source.getLeaderboardRank === 'function' ? await this.source.getLeaderboardRank(trainerId) : undefined;
      const ms = typeof this.source.getMilestoneProgress === 'function' ? await this.source.getMilestoneProgress(trainerId) : undefined;

      return {
        trainer,
        fanStats,
        leaderboard: lb,
        milestoneProgress: ms
      };
    }

    return null;
  }
}

/**
 * Adapter for Lexical Intelligence Knowledge Provider
 */
export class LexicalFederationAdapter implements KnowledgeProvider {
  public id = 'lexical';
  public authority = 80;

  constructor(public source: any) {}

  public supports(query: string, context?: FederationContext): boolean {
    return true; // Lexical can participate in all queries
  }

  public async search(query: string, options?: any): Promise<any> {
    if (typeof this.source.lookup === 'function') {
      return this.source.lookup(query);
    }
    return null;
  }

  public async resolve(query: string, context?: any): Promise<any> {
    if (typeof this.source.lookup === 'function') {
      const res = this.source.lookup(query);
      return {
        term: res.term,
        definition: res.definition,
        synonyms: res.synonyms,
        antonyms: res.antonyms,
        phraseMeaning: res.phraseMeaning,
        expandedTerms: res.expandedTerms,
        semanticScore: res.semanticScore
      };
    }
    return null;
  }
}

/**
 * Memory Federation Adapter (F23.11 - Reserved for M1 Memory Foundation)
 */
export class MemoryFederationAdapter implements KnowledgeProvider {
  public id = 'memory';
  public authority = 88;

  public supports(query: string, context?: FederationContext): boolean {
    return false; // Reserved for M1 Memory Foundation
  }

  public async search(query: string, options?: any): Promise<any> {
    return [];
  }

  public async resolve(query: string, context?: any): Promise<any> {
    return null;
  }
}

/**
 * Parallel execution resolver across participating providers.
 */
export class FederationResolver {
  /**
   * Executes queries concurrently across selected providers (F23.4 Parallel Execution).
   */
  public static async executeParallel(
    providers: KnowledgeProvider[],
    queryText: string,
    context: FederationContext
  ): Promise<{
    results: Record<string, KnowledgeProviderResult>;
    errors: ProviderError[];
  }> {
    const results: Record<string, KnowledgeProviderResult> = {};
    const errors: ProviderError[] = [];

    // Run all providers concurrently with Promise.allSettled
    const executionPromises = providers.map(async provider => {
      const startTime = Date.now();
      try {
        const data = await provider.resolve(queryText, context);
        const latencyMs = Date.now() - startTime;

        if (data !== null && data !== undefined) {
          // Calculate confidence based on provider baseline and data completeness
          let confidence = provider.authority >= 95 ? 0.98 : provider.authority >= 90 ? 0.95 : 0.85;
          if (data.confidence !== undefined) {
            confidence = data.confidence;
          }

          results[provider.id] = {
            providerId: provider.id,
            authority: provider.authority,
            confidence,
            data,
            latencyMs,
            timestamp: new Date()
          };
        }
      } catch (err: any) {
        errors.push({
          providerId: provider.id,
          error: err?.message || String(err),
          timestamp: new Date()
        });
      }
    });

    await Promise.allSettled(executionPromises);

    return { results, errors };
  }
}
