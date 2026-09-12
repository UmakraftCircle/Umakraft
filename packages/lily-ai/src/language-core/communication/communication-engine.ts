import { AudienceDetector } from './audience-detector.js';
import { ResponseStrategyEngine } from './response-strategy.js';
import { CommunicationStyleEngine } from './communication-style.js';
import { EmpathyEngine } from './empathy-engine.js';
import { ClarificationStrategy } from './clarification-strategy.js';
import { ResponsePrioritizer } from './response-prioritizer.js';
import { CommunicationContext } from './communication-context.js';
import { CommunicationMemory } from './communication-memory.js';
import { ClarificationRequest } from '../understanding/clarification/clarification-policy.js';

export interface CommunicationResult {
  strategy: string;
  audience: string;
  style: string;
  tone: string;
  priority: string[];
  confidence: number;
  clarificationType?: string;
  formattedQuestion?: string;
}

export class CommunicationEngine {
  private audienceDetector = new AudienceDetector();
  private responseStrategyEngine = new ResponseStrategyEngine();
  private styleEngine = new CommunicationStyleEngine();
  private empathyEngine = new EmpathyEngine();
  private clarificationStrategy = new ClarificationStrategy();
  private prioritizer = new ResponsePrioritizer();
  private context = new CommunicationContext();
  private memory = new CommunicationMemory();

  public communicate(params: {
    sessionId?: string;
    text: string;
    goal?: string;
    emotion?: string;
    glossaryTerms?: string[];
    clarificationNeeded?: boolean;
    clarification?: ClarificationRequest;
  }): CommunicationResult {
    const session = params.sessionId || 'default-session';

    const audienceProfile = this.audienceDetector.detect(params.text);

    const strategy = this.responseStrategyEngine.determine({
      text: params.text,
      goal: params.goal,
      emotion: params.emotion,
      clarificationNeeded: params.clarificationNeeded
    });

    const style = this.styleEngine.select({
      text: params.text,
      goal: params.goal
    });

    const empathy = this.empathyEngine.adjust(params.emotion || 'Neutral');

    const clarDetails = this.clarificationStrategy.mapStrategy(params.clarification);

    const priority = this.prioritizer.prioritize({
      text: params.text,
      goal: params.goal,
      glossaryTerms: params.glossaryTerms
    });

    this.context.update(session, {
      lastTopic: params.goal,
      lastStrategy: strategy
    });

    this.memory.recordInteraction(session, style, empathy.tone);

    const overallConfidence = (audienceProfile.confidence + 0.90) / 2;

    return {
      strategy,
      audience: audienceProfile.audienceType,
      style,
      tone: empathy.tone,
      priority,
      confidence: Number(overallConfidence.toFixed(2)),
      ...clarDetails
    };
  }

  public getAudienceDetector(): AudienceDetector {
    return this.audienceDetector;
  }

  public getResponseStrategyEngine(): ResponseStrategyEngine {
    return this.responseStrategyEngine;
  }

  public getStyleEngine(): CommunicationStyleEngine {
    return this.styleEngine;
  }

  public getEmpathyEngine(): EmpathyEngine {
    return this.empathyEngine;
  }

  public getClarificationStrategy(): ClarificationStrategy {
    return this.clarificationStrategy;
  }

  public getPrioritizer(): ResponsePrioritizer {
    return this.prioritizer;
  }

  public getContext(): CommunicationContext {
    return this.context;
  }

  public getMemory(): CommunicationMemory {
    return this.memory;
  }
}
export type { AudienceProfile } from './audience-detector.js';
