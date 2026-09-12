export type CandidateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROMOTED';

export type CandidateCategory = 'general' | 'community' | 'racing' | 'slang' | 'shorthand';

export interface LearningPolicy {
  /**
   * Minimum occurrences before a candidate is eligible for human review queue.
   */
  minFrequencyForReview: number;

  /**
   * Minimum confidence score (0.0 to 1.0) before review consideration.
   */
  minConfidenceForReview: number;

  /**
   * Minimum number of distinct user accounts observing the term.
   */
  minUniqueUsersForReview: number;

  /**
   * Minimum time window (in milliseconds) between first seen and review readiness.
   */
  minAgeMsForReview: number;

  /**
   * Absolute rule: Human review is mandatory. Automatic promotion is forbidden.
   */
  requireHumanReview: boolean;

  /**
   * Safety lock: Automatic promotion must always remain false.
   */
  allowAutoPromotion: boolean;

  /**
   * Minimum candidate score to permit promotion.
   */
  minScoreForPromotion: number;

  /**
   * Maximum stored candidates capacity before cleaning up lowest scored noise.
   */
  maxCandidatesCapacity: number;

  /**
   * Minimum token length to be considered a candidate.
   */
  minTokenLength: number;

  /**
   * Maximum token length.
   */
  maxTokenLength: number;

  /**
   * Separate community-specific vocabulary from standard English vocabulary.
   */
  enableCommunitySeparation: boolean;

  /**
   * Blacklisted sub-patterns that should immediately be discarded as noise.
   */
  blacklistedPatterns: string[];
}

export const DEFAULT_LEARNING_POLICY: LearningPolicy = {
  minFrequencyForReview: 3,
  minConfidenceForReview: 0.65,
  minUniqueUsersForReview: 1,
  minAgeMsForReview: 0,
  requireHumanReview: true,
  allowAutoPromotion: false, // Critical Rule: No automatic learning into production vocabulary
  minScoreForPromotion: 0.70,
  maxCandidatesCapacity: 10000,
  minTokenLength: 2,
  maxTokenLength: 30,
  enableCommunitySeparation: true,
  blacklistedPatterns: [
    'http://',
    'https://',
    'www.',
    '<@',
    '<#',
    '<:',
    'discord.gg'
  ]
};
