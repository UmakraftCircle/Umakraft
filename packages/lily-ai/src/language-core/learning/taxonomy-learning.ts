import { ConfidenceEngine } from './confidence-engine.js';
import { LearningCandidate } from './approval-queue.js';
import { TAXONOMY_DATA } from '../../knowledge/taxonomy/data.js';

export interface TaxonomyObservationInput {
  name: string;
  category: 'character' | 'skill' | 'event' | 'running_style' | 'distance' | 'surface' | 'track';
  frequency: number;
  contexts?: string[];
  metadata?: Record<string, any>;
}

export class TaxonomyLearning {
  private confidenceEngine: ConfidenceEngine;

  constructor(confidenceEngine?: ConfidenceEngine) {
    this.confidenceEngine = confidenceEngine || new ConfidenceEngine();
  }

  /**
   * Checks if an entity is already defined in canonical taxonomy.
   */
  public isKnownTaxonomy(name: string): boolean {
    const clean = name.trim().toLowerCase();
    for (const entity of TAXONOMY_DATA) {
      if (entity.canonical.toLowerCase() === clean) return true;
      if (entity.aliases.some(a => a.toLowerCase() === clean)) return true;
    }
    return false;
  }

  /**
   * Evaluates a potential taxonomy update (Character Name, Skill Name, Event Name, etc.).
   * STRICT CONSTRAINT: Only suggests. Never updates taxonomy automatically.
   */
  public evaluate(input: TaxonomyObservationInput): LearningCandidate | undefined {
    const { name, category, frequency, contexts = [], metadata = {} } = input;
    const cleanName = name.trim();
    if (!cleanName) return undefined;

    // If it's already in canonical taxonomy, no candidate needed
    if (this.isKnownTaxonomy(cleanName)) {
      return undefined;
    }

    const confidence = this.confidenceEngine.evaluate({
      frequency,
      consistency: 0.95,
      sourceQuality: 0.95,
      patternStrength: 0.90
    });

    const recommendation = this.confidenceEngine.getRecommendation(confidence);
    if (recommendation !== 'candidate') {
      return undefined;
    }

    const candidate: LearningCandidate = {
      id: `taxonomy_${cleanName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      type: 'taxonomy_candidate',
      candidateType: 'taxonomy',
      term: cleanName,
      candidate: cleanName,
      value: cleanName,
      confidence,
      metadata: {
        category,
        ...metadata
      },
      evidence: contexts.length > 0
        ? contexts
        : [`Discovered recurring potential ${category} name "${cleanName}" with ${frequency} occurrences`]
    };

    return candidate;
  }
}
