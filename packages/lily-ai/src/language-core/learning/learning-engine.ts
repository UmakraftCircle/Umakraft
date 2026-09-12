import { ObservationEngine, Observation } from './observation-engine.js';
import { PatternCollector, LanguagePattern } from './pattern-collector.js';
import { CandidateGenerator } from './candidate-generator.js';
import { VocabularyLearning } from './vocabulary-learning.js';
import { GlossaryLearning } from './glossary-learning.js';
import { TaxonomyLearning } from './taxonomy-learning.js';
import { ConfidenceEngine } from './confidence-engine.js';
import { ApprovalQueue, LearningCandidate } from './approval-queue.js';
import { LearningMemory } from './learning-memory.js';

export interface LearningInput {
  text: string;
  unknownWords?: string[];
  entities?: any[];
  facts?: any[];
  context?: Record<string, any>;
}

export interface LearningResult {
  observations: Observation[];
  patterns: LanguagePattern[];
  candidates: LearningCandidate[];
  confidence: number;
}

export class LearningEngine {
  private observationEngine = new ObservationEngine();
  private patternCollector = new PatternCollector();
  private confidenceEngine = new ConfidenceEngine();
  private vocabLearning = new VocabularyLearning(this.confidenceEngine);
  private glossaryLearning = new GlossaryLearning(this.confidenceEngine);
  private taxonomyLearning = new TaxonomyLearning(this.confidenceEngine);
  private candidateGenerator = new CandidateGenerator(
    this.confidenceEngine,
    this.vocabLearning,
    this.glossaryLearning,
    this.taxonomyLearning
  );
  private approvalQueue = new ApprovalQueue();
  private learningMemory = new LearningMemory();

  public getObservationEngine(): ObservationEngine {
    return this.observationEngine;
  }

  public getPatternCollector(): PatternCollector {
    return this.patternCollector;
  }

  public getConfidenceEngine(): ConfidenceEngine {
    return this.confidenceEngine;
  }

  public getCandidateGenerator(): CandidateGenerator {
    return this.candidateGenerator;
  }

  public getVocabularyLearning(): VocabularyLearning {
    return this.vocabLearning;
  }

  public getGlossaryLearning(): GlossaryLearning {
    return this.glossaryLearning;
  }

  public getTaxonomyLearning(): TaxonomyLearning {
    return this.taxonomyLearning;
  }

  public getApprovalQueue(): ApprovalQueue {
    return this.approvalQueue;
  }

  public getLearningMemory(): LearningMemory {
    return this.learningMemory;
  }

  /**
   * Main learning processing cycle.
   * STRICT CONSTRAINT: Observes, tracks, analyzes, and generates candidates.
   * NEVER modifies taxonomy, dictionary, glossary, knowledge, or behavior automatically.
   */
  public process(input: string | LearningInput): LearningResult {
    const params: LearningInput = typeof input === 'string' ? { text: input } : input;
    const { text, unknownWords = [] } = params;

    const currentObservations: Observation[] = [];
    const generatedCandidates: LearningCandidate[] = [];

    // 1. Observe and Track Unknown Words & Phrases
    for (const word of unknownWords) {
      const obs = this.observationEngine.observe(word, text);
      currentObservations.push(obs);

      // Record in learning memory
      const mem = this.learningMemory.track(word, 1, 'observing');

      // Check if threshold reached for candidate generation
      const candidate = this.candidateGenerator.detectAndGenerate(word, obs.frequency, obs.contexts);
      if (candidate) {
        // Enqueue into approval queue for developer/human review
        this.approvalQueue.submit(candidate);
        this.learningMemory.updateStatus(word, 'pending_review');
        generatedCandidates.push(candidate);
      }
    }

    // Also observe potential domain phrases if text matches multi-word domain queries
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length < 50 && !unknownWords.includes(trimmed.toLowerCase())) {
      // Check if text is a candidate multi-word concept (e.g. "blue spark route", "uma guide")
      const words = trimmed.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        const obs = this.observationEngine.observe(trimmed, text);
        currentObservations.push(obs);

        const candidate = this.candidateGenerator.detectAndGenerate(trimmed, obs.frequency, obs.contexts);
        if (candidate) {
          this.approvalQueue.submit(candidate);
          this.learningMemory.updateStatus(trimmed, 'pending_review');
          generatedCandidates.push(candidate);
        }
      }
    }

    // 2. Collect Language Patterns
    const patterns = this.patternCollector.collect(text);

    // 3. Compute overall learning confidence
    let totalConfidence = 0.85;
    if (generatedCandidates.length > 0) {
      const maxCandConf = Math.max(...generatedCandidates.map(c => c.confidence));
      totalConfidence = maxCandConf;
    } else if (patterns.length > 0) {
      totalConfidence = 0.90;
    }

    return {
      observations: currentObservations,
      patterns,
      candidates: generatedCandidates,
      confidence: totalConfidence
    };
  }
}
