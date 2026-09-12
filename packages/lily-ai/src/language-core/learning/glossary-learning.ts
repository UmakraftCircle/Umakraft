import { ConfidenceEngine } from './confidence-engine.js';
import { LearningCandidate } from './approval-queue.js';

export interface GlossaryObservationInput {
  term: string;
  frequency: number;
  domain?: string;
  contexts?: string[];
}

export class GlossaryLearning {
  private confidenceEngine: ConfidenceEngine;

  constructor(confidenceEngine?: ConfidenceEngine) {
    this.confidenceEngine = confidenceEngine || new ConfidenceEngine();
  }

  /**
   * Evaluates repeated multi-word or domain-specific community terms and suggests a glossary addition candidate.
   */
  public evaluate(input: GlossaryObservationInput): LearningCandidate | undefined {
    const { term, frequency, domain = 'Umamusume', contexts = [] } = input;
    const cleanTerm = term.trim().toLowerCase();
    if (!cleanTerm) return undefined;

    const confidence = this.confidenceEngine.evaluate({
      frequency,
      consistency: 0.94,
      sourceQuality: 0.92,
      patternStrength: 0.88
    });

    const recommendation = this.confidenceEngine.getRecommendation(confidence);
    if (recommendation !== 'candidate') {
      return undefined;
    }

    const candidate: LearningCandidate = {
      id: `glossary_${cleanTerm.replace(/\s+/g, '_')}_${Date.now()}`,
      type: 'glossary_candidate',
      candidateType: 'glossary',
      term: cleanTerm,
      candidate: cleanTerm,
      value: cleanTerm,
      domain,
      confidence,
      evidence: contexts.length > 0
        ? contexts
        : [`Observed domain term "${cleanTerm}" ${frequency} times in domain "${domain}"`]
    };

    return candidate;
  }
}
