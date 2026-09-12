import { MeaningResolver } from './meaning-resolver.js';
import { GoalDetector } from './goal-detector.js';
import { EmotionDetector } from './emotion-detector.js';
import { ContextUnderstanding, ContextState } from './context-understanding.js';
import { AmbiguityEngine } from './ambiguity-engine.js';
import { IntentHints } from './intent-hints.js';
import { ConfidenceEngine } from './confidence-engine.js';
import { UnderstandingMemory } from './understanding-memory.js';
import { ClarificationPolicy, ClarificationRequest } from './clarification/index.js';

export interface UnderstandingResult {
  goal?: string;
  emotion?: string;
  entities: string[];
  context: object;
  ambiguity: boolean;
  confidence: number;
  possibleIntent?: string;
  clarificationNeeded: boolean;
  clarification?: ClarificationRequest;
}

export class UnderstandingEngine {
  private meaningResolver = new MeaningResolver();
  private goalDetector = new GoalDetector();
  private emotionDetector = new EmotionDetector();
  private contextUnderstanding = new ContextUnderstanding();
  private ambiguityEngine = new AmbiguityEngine();
  private intentHints = new IntentHints();
  private confidenceEngine = new ConfidenceEngine();
  private memory = new UnderstandingMemory();
  private clarificationPolicy = new ClarificationPolicy();

  /**
   * Orchestrates sub-engines to produce deep semantic meaning from unstructured text
   */
  public understand(
    text: string,
    facts: any[] = [],
    entities: any[] = [],
    contextState: ContextState = {}
  ): UnderstandingResult {
    const normalizedText = text.trim();

    // 1. Resolve memory pattern mapping if applicable
    let mappedText = normalizedText;
    const resolvedPattern = this.memory.resolvePattern(normalizedText);
    if (resolvedPattern) {
      mappedText = resolvedPattern;
    }

    // 2. Goal Detection
    const goal = this.goalDetector.detect(mappedText);

    // 3. Emotion Detection
    const emotion = this.emotionDetector.detect(mappedText);

    // 4. Meaning Resolution
    const resolvedMeaning = this.meaningResolver.resolve(mappedText, facts, entities);

    // 5. Context Resolution
    const contextResult = this.contextUnderstanding.resolveContext(mappedText, contextState);

    // 6. Ambiguity Analysis
    const ambiguityResult = this.ambiguityEngine.analyze(mappedText);

    // 7. Intent Hints
    const hints = this.intentHints.generateHints(mappedText);
    const topHint = hints.length > 0 ? hints[0] : undefined;

    // 8. Confidence Score calculation
    const words = mappedText.split(/\s+/).filter(w => w.length > 0);
    const confidenceScoreObj = this.confidenceEngine.calculate({
      ambiguous: ambiguityResult.ambiguous,
      hasGoal: !!goal,
      hasEmotion: emotion !== 'Neutral',
      contextResolved: contextResult.contextResolved,
      needsContext: contextResult.needsContext,
      wordCount: words.length
    });

    // 9. Assemble entities list
    const entityNames = entities.map(e => e.name || e.text).filter(Boolean);

    // Merge everything into a cohesive Context object safely
    const mergedContext: any = {
      ...resolvedMeaning,
      contextResolved: contextResult.contextResolved,
      needsContext: contextResult.needsContext
    };
    if (contextResult.character !== undefined) {
      mergedContext.character = contextResult.character;
    }
    if (contextResult.event !== undefined) {
      mergedContext.event = contextResult.event;
    }
    if (ambiguityResult.options) {
      mergedContext.options = ambiguityResult.options;
    }

    // 10. Clarification Policy check (F7.5A integration)
    const clarificationEvaluation = this.clarificationPolicy.evaluate({
      text: mappedText,
      confidence: confidenceScoreObj.score,
      ambiguity: ambiguityResult.ambiguous,
      context: mergedContext
    });

    return {
      goal,
      emotion,
      entities: entityNames,
      context: mergedContext,
      ambiguity: ambiguityResult.ambiguous,
      confidence: confidenceScoreObj.score,
      possibleIntent: topHint?.possibleIntent,
      clarificationNeeded: clarificationEvaluation.clarificationNeeded,
      clarification: clarificationEvaluation.clarification
    };
  }

  // Sub-engine getters
  public getMeaningResolver(): MeaningResolver {
    return this.meaningResolver;
  }

  public getGoalDetector(): GoalDetector {
    return this.goalDetector;
  }

  public getEmotionDetector(): EmotionDetector {
    return this.emotionDetector;
  }

  public getContextUnderstanding(): ContextUnderstanding {
    return this.contextUnderstanding;
  }

  public getAmbiguityEngine(): AmbiguityEngine {
    return this.ambiguityEngine;
  }

  public getIntentHints(): IntentHints {
    return this.intentHints;
  }

  public getConfidenceEngine(): ConfidenceEngine {
    return this.confidenceEngine;
  }

  public getMemory(): UnderstandingMemory {
    return this.memory;
  }

  public getClarificationPolicy(): ClarificationPolicy {
    return this.clarificationPolicy;
  }
}
export type { ContextState };
