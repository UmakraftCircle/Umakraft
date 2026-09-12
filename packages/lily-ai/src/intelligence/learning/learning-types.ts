export enum LearningScope {
  PREFERENCES = 'PREFERENCES',
  OUTCOMES = 'OUTCOMES',
  STRATEGIES = 'STRATEGIES'
}

export interface RecommendationScore {
  recommendationId: string;
  successRate: number;
  usageRate: number;
  confidence: number;
}

export interface TrainerPreference {
  prefersMeta: boolean;
  preferredStyles: string[];
  preferredCharacters: string[];
}

export interface LilyPerformance {
  recommendationAccuracy: number;
  trainerSatisfaction: number;
  parentSearchSuccess: number;
  coachingEffectiveness: number;
}
