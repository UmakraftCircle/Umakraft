import { ConfidenceEngine } from './confidence-engine.js';
import { LearningCandidate } from './approval-queue.js';

export interface UnknownWordInput {
  word: string;
  frequency: number;
  contexts?: string[];
}

export class VocabularyLearning {
  private confidenceEngine: ConfidenceEngine;

  constructor(confidenceEngine?: ConfidenceEngine) {
    this.confidenceEngine = confidenceEngine || new ConfidenceEngine();
  }

  /**
   * Evaluates an unknown word and suggests a dictionary addition candidate if confidence threshold (>=0.90) is met.
   * Flow: Unknown Word -> Repeated Usage -> High Confidence -> Candidate
   */
  public evaluate(input: UnknownWordInput): LearningCandidate | undefined {
    const { word, frequency, contexts = [] } = input;
    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) return undefined;

    const confidence = this.confidenceEngine.evaluate({
      frequency,
      consistency: 0.92,
      sourceQuality: 0.90,
      patternStrength: 0.85
    });

    const recommendation = this.confidenceEngine.getRecommendation(confidence);
    if (recommendation !== 'candidate') {
      return undefined;
    }

    const candidate: LearningCandidate = {
      id: `vocab_${cleanWord}_${Date.now()}`,
      type: 'dictionary_candidate',
      candidateType: 'dictionary',
      word: cleanWord,
      term: cleanWord,
      candidate: cleanWord,
      value: cleanWord,
      confidence,
      evidence: contexts.length > 0
        ? contexts
        : [`Observed unknown word "${cleanWord}" ${frequency} times across inputs`]
    };

    return candidate;
  }
}
