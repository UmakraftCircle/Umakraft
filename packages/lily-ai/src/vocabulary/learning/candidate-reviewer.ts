import { CandidateRegistry, VocabularyCandidate } from './candidate-registry.js';
import { CandidateCategory, LearningPolicy, DEFAULT_LEARNING_POLICY } from './learning-policy.js';
import { LearningStatistics } from './learning-statistics.js';
import { CandidateScorer } from './candidate-scorer.js';

export interface ReviewQueueFilter {
  minConfidence?: number;
  minFrequency?: number;
  category?: CandidateCategory;
  limit?: number;
}

export interface ReviewResult {
  success: boolean;
  candidate?: VocabularyCandidate;
  error?: string;
}

export class CandidateReviewer {
  private registry: CandidateRegistry;
  private policy: LearningPolicy;
  private stats: LearningStatistics;
  private scorer: CandidateScorer;

  constructor(
    registry: CandidateRegistry,
    policy: LearningPolicy = DEFAULT_LEARNING_POLICY,
    stats?: LearningStatistics,
    scorer?: CandidateScorer
  ) {
    this.registry = registry;
    this.policy = policy;
    this.stats = stats || new LearningStatistics();
    this.scorer = scorer || new CandidateScorer();
  }

  /**
   * Retrieves pending candidates eligible for human review.
   */
  public getReviewQueue(filter?: ReviewQueueFilter): VocabularyCandidate[] {
    const minConf = filter?.minConfidence ?? this.policy.minConfidenceForReview;
    const minFreq = filter?.minFrequency ?? this.policy.minFrequencyForReview;
    const category = filter?.category;
    const limit = filter?.limit ?? 50;

    const pending = this.registry.getByStatus('PENDING');

    // Ensure all scores and context analyses are up to date
    for (const c of pending) {
      if (!c.scoreDetails) {
        const scoreRes = this.scorer.score(c);
        c.confidence = scoreRes.confidence;
        c.scoreDetails = scoreRes.scoreDetails;
        if (scoreRes.contextAnalysis) {
          c.inferredMeaning = scoreRes.contextAnalysis.inferredMeaning;
          c.partOfSpeech = scoreRes.contextAnalysis.partOfSpeech;
        }
      }
    }

    const eligible = pending.filter(c => {
      if (c.confidence < minConf && c.frequency < minFreq) return false;
      if (category && c.category !== category) return false;
      if (c.uniqueUsers.length < this.policy.minUniqueUsersForReview && c.frequency < 10) return false;
      return true;
    });

    // Sort descending by confidence, then frequency
    eligible.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return b.frequency - a.frequency;
    });

    return eligible.slice(0, limit);
  }

  /**
   * Human admin approves a vocabulary candidate for promotion.
   */
  public approve(
    term: string,
    reviewerId: string = 'admin',
    notes?: string,
    customMeaning?: string
  ): ReviewResult {
    const candidate = this.registry.get(term);
    if (!candidate) {
      return { success: false, error: `Candidate term '${term}' not found in registry.` };
    }

    if (candidate.status === 'PROMOTED') {
      return { success: false, error: `Candidate term '${term}' is already promoted.` };
    }

    candidate.status = 'APPROVED';
    candidate.reviewedBy = reviewerId;
    candidate.reviewedAt = new Date();
    candidate.reviewNotes = notes || 'Approved by human reviewer';

    if (customMeaning) {
      candidate.inferredMeaning = customMeaning;
      candidate.suggestedDefinition = customMeaning;
    } else if (!candidate.suggestedDefinition && candidate.inferredMeaning) {
      candidate.suggestedDefinition = candidate.inferredMeaning;
    }

    this.registry.update(candidate);
    this.stats.recordApproval();

    return { success: true, candidate };
  }

  /**
   * Human admin rejects a vocabulary candidate (e.g. spam, typo, undesirable).
   */
  public reject(
    term: string,
    reviewerId: string = 'admin',
    reason: string = 'Rejected by human reviewer'
  ): ReviewResult {
    const candidate = this.registry.get(term);
    if (!candidate) {
      return { success: false, error: `Candidate term '${term}' not found in registry.` };
    }

    candidate.status = 'REJECTED';
    candidate.reviewedBy = reviewerId;
    candidate.reviewedAt = new Date();
    candidate.rejectionReason = reason;

    this.registry.update(candidate);
    this.stats.recordRejection();

    return { success: true, candidate };
  }

  /**
   * Human admin edits candidate properties prior to approval or promotion.
   */
  public edit(term: string, updates: Partial<VocabularyCandidate>): ReviewResult {
    const candidate = this.registry.get(term);
    if (!candidate) {
      return { success: false, error: `Candidate term '${term}' not found in registry.` };
    }

    if (updates.inferredMeaning) candidate.inferredMeaning = updates.inferredMeaning;
    if (updates.suggestedDefinition) candidate.suggestedDefinition = updates.suggestedDefinition;
    if (updates.partOfSpeech) candidate.partOfSpeech = updates.partOfSpeech;
    if (updates.category) candidate.category = updates.category;
    if (updates.tags) candidate.tags = updates.tags;
    if (updates.reviewNotes) candidate.reviewNotes = updates.reviewNotes;

    this.registry.update(candidate);

    return { success: true, candidate };
  }
}
