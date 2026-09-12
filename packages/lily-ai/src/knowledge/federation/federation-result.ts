import { FederationContext } from './federation-context.js';

export interface KnowledgeProviderResult<T = any> {
  providerId: string;
  authority: number;
  confidence: number;
  data: T;
  matchedEntities?: string[];
  metadata?: Record<string, unknown>;
  latencyMs?: number;
  timestamp: Date;
}

export interface ProviderError {
  providerId: string;
  error: string;
  timestamp: Date;
}

export interface ResponsePlanStep {
  type: 'current_situation' | 'relevant_guide' | 'foundational_concept' | 'recommended_action' | 'lexical_note';
  title: string;
  content: string;
  sourceProvider: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface ResponsePlan {
  headline: string;
  steps: ResponsePlanStep[];
  suggestedAction?: string;
  summaryText?: string;
}

export interface FederatedKnowledgeSections {
  taxonomy?: {
    nodes?: Array<{
      id: string;
      name: string;
      category: string;
      aliases?: string[];
      metadata?: Record<string, unknown>;
    }>;
    matchedCategory?: string;
    primaryEntity?: string;
    canonical?: string;
  };
  handbook?: {
    guides?: Array<{
      id: string;
      title: string;
      category: string;
      recommendations?: string[];
      summary?: string;
      content?: string;
      version?: string;
    }>;
    primaryRecommendation?: string;
    suggestedBuild?: string;
  };
  database?: {
    trainer?: {
      trainerId: string;
      trainerName: string;
      clubName?: string;
      linkedDiscordId?: string;
    };
    fanStats?: {
      totalFans: number;
      dailyGain: number;
      monthlyGain: number;
      currentMilestone?: string;
      nextMilestone?: string;
      remainingFansToNextMilestone?: number;
      deficit?: number;
      surplus?: number;
      requiredDailyGain?: number;
      projectedMonthEnd?: number;
    };
    leaderboard?: {
      rank: number;
      trainerName: string;
      fans: number;
      nearbyCompetitors?: {
        distanceToAbove?: number;
        distanceToBelow?: number;
      };
    };
    club?: {
      clubName: string;
      rank?: number;
      memberCount: number;
      totalFans: number;
      status?: string;
    };
    milestoneProgress?: {
      currentFans: number;
      currentMilestone?: string;
      nextMilestone?: string;
      remainingFans: number;
      isEligible150M: boolean;
      isEligible200M: boolean;
      isEligible300M: boolean;
    };
  };
  lexical?: {
    definition?: string;
    synonyms?: string[];
    antonyms?: string[];
    phraseMeaning?: string;
    expandedTerms?: string[];
    semanticScore?: number;
  };
}

export interface FederatedResult {
  query: string;
  context: FederationContext;
  participatingProviders: string[];
  providerResults: Record<string, KnowledgeProviderResult>;
  errors?: ProviderError[];
  sections: FederatedKnowledgeSections;
  aggregatedData: Record<string, any>;
  confidence: number;
  conflictsResolved?: Array<{
    field: string;
    winningProvider: string;
    losingProvider: string;
    reason: string;
  }>;
  responsePlan?: ResponsePlan;
  totalLatencyMs: number;
  timestamp: Date;
}
