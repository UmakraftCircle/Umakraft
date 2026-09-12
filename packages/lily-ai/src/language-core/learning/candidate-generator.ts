import { LearningCandidate } from './approval-queue.js';
import { VocabularyLearning } from './vocabulary-learning.js';
import { GlossaryLearning } from './glossary-learning.js';
import { TaxonomyLearning } from './taxonomy-learning.js';
import { ConfidenceEngine } from './confidence-engine.js';

export class CandidateGenerator {
  private vocabLearning: VocabularyLearning;
  private glossaryLearning: GlossaryLearning;
  private taxonomyLearning: TaxonomyLearning;
  private confidenceEngine: ConfidenceEngine;

  constructor(
    confidenceEngine?: ConfidenceEngine,
    vocabLearning?: VocabularyLearning,
    glossaryLearning?: GlossaryLearning,
    taxonomyLearning?: TaxonomyLearning
  ) {
    this.confidenceEngine = confidenceEngine || new ConfidenceEngine();
    this.vocabLearning = vocabLearning || new VocabularyLearning(this.confidenceEngine);
    this.glossaryLearning = glossaryLearning || new GlossaryLearning(this.confidenceEngine);
    this.taxonomyLearning = taxonomyLearning || new TaxonomyLearning(this.confidenceEngine);
  }

  /**
   * Generates a learning candidate for an observed term.
   * Nothing is automatically learned or applied.
   */
  public generateCandidate(
    term: string,
    frequency: number,
    candidateType: 'dictionary' | 'glossary' | 'taxonomy' = 'dictionary',
    metadata?: Record<string, any>
  ): LearningCandidate | undefined {
    switch (candidateType) {
      case 'dictionary':
        return this.vocabLearning.evaluate({
          word: term,
          frequency,
          contexts: metadata?.contexts
        });

      case 'glossary':
        return this.glossaryLearning.evaluate({
          term,
          frequency,
          domain: metadata?.domain || 'Umamusume',
          contexts: metadata?.contexts
        });

      case 'taxonomy':
        return this.taxonomyLearning.evaluate({
          name: term,
          category: metadata?.category || 'character',
          frequency,
          contexts: metadata?.contexts,
          metadata
        });

      default:
        return undefined;
    }
  }

  /**
   * Evaluates unknown words or phrases and auto-detects candidate type based on phrase structure.
   */
  public detectAndGenerate(term: string, frequency: number, contexts?: string[]): LearningCandidate | undefined {
    const trimmed = term.trim();
    if (!trimmed) return undefined;

    // Multi-word expressions are good glossary candidates (e.g. "blue spark route")
    if (trimmed.includes(' ')) {
      return this.generateCandidate(trimmed, frequency, 'glossary', { contexts });
    }

    // Single words are vocabulary/dictionary candidates (e.g. "poggers", "reroll")
    return this.generateCandidate(trimmed, frequency, 'dictionary', { contexts });
  }
}
