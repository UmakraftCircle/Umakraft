import { CandidateRegistry, VocabularyCandidate } from './candidate-registry.js';
import { LearningPolicy, DEFAULT_LEARNING_POLICY } from './learning-policy.js';
import { LearningStatistics } from './learning-statistics.js';
import { DictionaryRegistry } from '../dictionary/dictionary-registry.js';
import { DefinitionRegistry } from '../definitions/definition-registry.js';
import { VocabularyRegistry } from '../vocabulary-registry.js';

export interface PromotionOptions {
  promoterId?: string;
  targetRegistry?: 'dictionary' | 'definition' | 'vocabulary' | 'all';
  dictionaryRegistry?: DictionaryRegistry;
  definitionRegistry?: DefinitionRegistry;
  vocabularyRegistry?: VocabularyRegistry;
  customDefinition?: string;
  partOfSpeech?: string;
  context?: string;
  tags?: string[];
}

export interface PromotionResult {
  success: boolean;
  promotedTerm?: string;
  candidate?: VocabularyCandidate;
  promotedTo: string[];
  error?: string;
}

export interface PromotionRecord {
  term: string;
  promotedAt: Date;
  promotedBy: string;
  definition: string;
  category: string;
  registries: string[];
}

export class CandidatePromoter {
  private registry: CandidateRegistry;
  private policy: LearningPolicy;
  private stats: LearningStatistics;
  private promotionHistory: PromotionRecord[] = [];

  constructor(
    registry: CandidateRegistry,
    policy: LearningPolicy = DEFAULT_LEARNING_POLICY,
    stats?: LearningStatistics
  ) {
    this.registry = registry;
    this.policy = policy;
    this.stats = stats || new LearningStatistics();
  }

  /**
   * Promotes an APPROVED candidate to official dictionary and definition registries.
   * CRITICAL: Rejects any attempt to promote unapproved or auto-promoted terms.
   */
  public promote(
    term: string,
    options?: PromotionOptions
  ): PromotionResult {
    const candidate = this.registry.get(term);
    if (!candidate) {
      return { success: false, error: `Candidate term '${term}' does not exist in learning registry.`, promotedTo: [] };
    }

    // Safety check 1: Candidate MUST be in APPROVED status
    if (candidate.status !== 'APPROVED') {
      return {
        success: false,
        error: `Cannot promote candidate '${term}'. Status is '${candidate.status}', but must be 'APPROVED' by human review first.`,
        promotedTo: []
      };
    }

    const promoterId = options?.promoterId || candidate.reviewedBy || 'admin';
    const definitionText = options?.customDefinition ||
      candidate.suggestedDefinition ||
      candidate.inferredMeaning ||
      `Community learned vocabulary term: ${candidate.term}`;

    const partOfSpeech = options?.partOfSpeech || candidate.partOfSpeech || 'noun';
    const context = options?.context || (candidate.category === 'community' || candidate.category === 'racing' ? 'uma_musume' : 'general');
    const tags = options?.tags || candidate.tags || ['learned', candidate.category];

    const promotedTo: string[] = [];

    // 1. Promote to Dictionary Registry if provided
    if (options?.dictionaryRegistry) {
      options.dictionaryRegistry.register({
        word: candidate.term,
        normalizedWord: candidate.term,
        definitions: [definitionText],
        partOfSpeech,
        confidence: Number(Math.min(0.95, candidate.confidence).toFixed(2)),
        examples: candidate.contextSamples.length > 0 ? [candidate.contextSamples[0]] : undefined
      });
      promotedTo.push('dictionary');
    }

    // 2. Promote to Definition Registry if provided
    if (options?.definitionRegistry) {
      options.definitionRegistry.register({
        word: candidate.term,
        definition: definitionText,
        partOfSpeech,
        context,
        authority: 50,
        confidence: Number(Math.min(0.95, candidate.confidence).toFixed(2)),
        source: 'learned_candidate',
        tags,
        examples: candidate.contextSamples.length > 0 ? [candidate.contextSamples[0]] : undefined
      });
      promotedTo.push('definition');
    }

    // 3. Promote to Vocabulary Registry if provided
    if (options?.vocabularyRegistry) {
      options.vocabularyRegistry.register({
        word: candidate.term,
        definition: definitionText,
        partOfSpeech,
        language: 'en',
        metadata: {
          category: candidate.category,
          confidence: Number(Math.min(0.95, candidate.confidence).toFixed(2))
        }
      });
      promotedTo.push('vocabulary');
    }

    // If no explicit external registry was passed, register internal promotion record
    if (promotedTo.length === 0) {
      promotedTo.push('learned_vocabulary_archive');
    }

    // Update candidate status to PROMOTED
    candidate.status = 'PROMOTED';
    candidate.promotedAt = new Date();
    candidate.promotedBy = promoterId;
    candidate.suggestedDefinition = definitionText;

    this.registry.update(candidate);
    this.stats.recordPromotion();

    this.promotionHistory.push({
      term: candidate.term,
      promotedAt: candidate.promotedAt,
      promotedBy: promoterId,
      definition: definitionText,
      category: candidate.category,
      registries: [...promotedTo]
    });

    return {
      success: true,
      promotedTerm: candidate.term,
      candidate,
      promotedTo
    };
  }

  public getPromotionHistory(): PromotionRecord[] {
    return [...this.promotionHistory];
  }
}
