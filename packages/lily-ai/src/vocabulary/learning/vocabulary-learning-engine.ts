import {
  CandidateCategory,
  CandidateStatus,
  LearningPolicy,
  DEFAULT_LEARNING_POLICY
} from './learning-policy.js';
import {
  CandidateRegistry,
  VocabularyCandidate,
  CandidateScoreDetails
} from './candidate-registry.js';
import { CandidateDetector, DetectedCandidateToken } from './candidate-detector.js';
import { CandidateScorer, ContextAnalysisResult } from './candidate-scorer.js';
import { CandidateReviewer, ReviewQueueFilter, ReviewResult } from './candidate-reviewer.js';
import { CandidatePromoter, PromotionOptions, PromotionResult, PromotionRecord } from './candidate-promoter.js';
import { CandidateCache } from './candidate-cache.js';
import { LearningStatistics, LearningStatisticsData } from './learning-statistics.js';
import { LilyVocabularyProvider } from '../lily-vocabulary-provider.js';
import { DictionaryKnowledgeProvider } from '../dictionary/dictionary-provider.js';
import { DefinitionKnowledgeProvider } from '../definitions/definition-provider.js';
import { TaxonomyKnowledgeProvider } from '../../knowledge/providers/taxonomy/taxonomy-provider.js';
import { GlossaryService } from '../../language-core/glossary/glossary-service.js';

export interface ObserveOptions {
  userId?: string;
  channelId?: string;
  category?: CandidateCategory;
  skipNoiseFilter?: boolean;
}

export class VocabularyLearningEngine {
  private policy: LearningPolicy;
  private registry: CandidateRegistry;
  private detector: CandidateDetector;
  private scorer: CandidateScorer;
  private reviewer: CandidateReviewer;
  private promoter: CandidatePromoter;
  private cache: CandidateCache;
  private stats: LearningStatistics;

  constructor(
    policy: LearningPolicy = DEFAULT_LEARNING_POLICY,
    dependencies?: {
      vocabularyProvider?: LilyVocabularyProvider;
      dictionaryProvider?: DictionaryKnowledgeProvider;
      definitionProvider?: DefinitionKnowledgeProvider;
      taxonomyProvider?: TaxonomyKnowledgeProvider;
      glossaryService?: GlossaryService;
    }
  ) {
    this.policy = { ...policy };
    this.registry = new CandidateRegistry();
    this.detector = new CandidateDetector(
      this.policy,
      dependencies?.vocabularyProvider,
      dependencies?.dictionaryProvider,
      dependencies?.definitionProvider,
      dependencies?.taxonomyProvider,
      dependencies?.glossaryService
    );
    this.scorer = new CandidateScorer(this.detector);
    this.stats = new LearningStatistics();
    this.reviewer = new CandidateReviewer(this.registry, this.policy, this.stats, this.scorer);
    this.promoter = new CandidatePromoter(this.registry, this.policy, this.stats);
    this.cache = new CandidateCache();
  }

  public getRegistry(): CandidateRegistry {
    return this.registry;
  }

  public getDetector(): CandidateDetector {
    return this.detector;
  }

  public getScorer(): CandidateScorer {
    return this.scorer;
  }

  public getReviewer(): CandidateReviewer {
    return this.reviewer;
  }

  public getPromoter(): CandidatePromoter {
    return this.promoter;
  }

  public getCache(): CandidateCache {
    return this.cache;
  }

  public getPolicy(): LearningPolicy {
    return { ...this.policy };
  }

  public updatePolicy(updates: Partial<LearningPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Observes an incoming text message, detects unknown words, tracks frequency, and scores candidates.
   * Does NOT alter production vocabulary. Strictly records learning candidates.
   */
  public observe(text: string, options?: ObserveOptions): VocabularyCandidate[] {
    if (!text || typeof text !== 'string') return [];

    const detected = this.detector.detect(text);
    const observedCandidates: VocabularyCandidate[] = [];

    for (const item of detected) {
      if (!item.plausible && !options?.skipNoiseFilter) {
        // Log low-score occurrence but flag
        const { candidate, isNew } = this.registry.recordOccurrence(
          item.term,
          item.contextSentence,
          options?.userId,
          item.category
        );
        this.stats.recordObservation(item.category, isNew);
        this.rescore(candidate);
        continue;
      }

      const category = options?.category || item.category;
      const { candidate, isNew } = this.registry.recordOccurrence(
        item.term,
        item.contextSentence,
        options?.userId,
        category
      );

      this.stats.recordObservation(category, isNew);
      this.rescore(candidate);
      this.cache.set(`candidate:${candidate.term}`, candidate);
      observedCandidates.push(candidate);
    }

    return observedCandidates;
  }

  /**
   * Explicitly tracks an observation of a specific term.
   */
  public track(
    term: string,
    contextSentence: string = '',
    userId?: string,
    category: CandidateCategory = 'general'
  ): VocabularyCandidate {
    const { candidate, isNew } = this.registry.recordOccurrence(
      term,
      contextSentence,
      userId,
      category
    );

    this.stats.recordObservation(category, isNew);
    this.rescore(candidate);
    this.cache.set(`candidate:${candidate.term}`, candidate);
    return candidate;
  }

  /**
   * Recalculates scoring and context analysis for a candidate.
   */
  public rescore(candidate: VocabularyCandidate): number {
    const scoreRes = this.scorer.score(candidate);
    candidate.confidence = scoreRes.confidence;
    candidate.scoreDetails = scoreRes.scoreDetails;

    if (scoreRes.contextAnalysis) {
      candidate.inferredMeaning = scoreRes.contextAnalysis.inferredMeaning;
      candidate.partOfSpeech = scoreRes.contextAnalysis.partOfSpeech;
      if (!candidate.suggestedDefinition) {
        candidate.suggestedDefinition = scoreRes.contextAnalysis.inferredMeaning;
      }
    }

    this.registry.update(candidate);
    return candidate.confidence;
  }

  /**
   * Calculates score for a term.
   */
  public score(term: string): number {
    const candidate = this.registry.get(term);
    if (!candidate) return 0;
    return this.rescore(candidate);
  }

  /**
   * Human Review: Approves a candidate for promotion.
   */
  public approve(
    term: string,
    reviewerId: string = 'admin',
    notes?: string,
    customMeaning?: string
  ): boolean {
    const result = this.reviewer.approve(term, reviewerId, notes, customMeaning);
    return result.success;
  }

  /**
   * Human Review: Rejects a candidate.
   */
  public reject(
    term: string,
    reviewerId: string = 'admin',
    reason?: string
  ): boolean {
    const result = this.reviewer.reject(term, reviewerId, reason);
    return result.success;
  }

  /**
   * Human Review: Edits a candidate.
   */
  public edit(term: string, updates: Partial<VocabularyCandidate>): ReviewResult {
    return this.reviewer.edit(term, updates);
  }

  /**
   * Promotes an approved candidate into production dictionary/definition registries.
   */
  public promote(
    term: string,
    options?: PromotionOptions
  ): PromotionResult {
    return this.promoter.promote(term, options);
  }

  /**
   * Retrieves candidates matching optional filter criteria.
   */
  public getCandidates(filter?: {
    status?: CandidateStatus;
    category?: CandidateCategory;
    minConfidence?: number;
    minFrequency?: number;
  }): VocabularyCandidate[] {
    let list = this.registry.getAll();

    if (filter?.status) {
      list = list.filter(c => c.status === filter.status);
    }
    if (filter?.category) {
      list = list.filter(c => c.category === filter.category);
    }
    if (filter?.minConfidence !== undefined) {
      list = list.filter(c => c.confidence >= filter.minConfidence!);
    }
    if (filter?.minFrequency !== undefined) {
      list = list.filter(c => c.frequency >= filter.minFrequency!);
    }

    return list;
  }

  /**
   * Retrieves pending items waiting for human review.
   */
  public getReviewQueue(filter?: ReviewQueueFilter): VocabularyCandidate[] {
    return this.reviewer.getReviewQueue(filter);
  }

  /**
   * Returns complete learning statistics and accuracy metrics.
   */
  public getStatistics(): LearningStatisticsData {
    return this.stats.getSnapshot();
  }

  /**
   * Returns list of all promoted entries history.
   */
  public getPromotionHistory(): PromotionRecord[] {
    return this.promoter.getPromotionHistory();
  }

  /**
   * Clears candidate data.
   */
  public clear(): void {
    this.registry.clear();
    this.cache.clear();
    this.stats.reset();
  }
}
