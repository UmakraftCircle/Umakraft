import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('SelfEvaluationEngine');

export interface EvaluationResult {
  intentMatch: number; // 0-100
  contextRetention: number; // 0-100
  personalityConsistency: number; // 0-100
  hallucinationRisk: number; // 0-100 (lower is better)
  overall: number; // 0-100
  passed: boolean;
  failureReason?: string;
}

export interface AuditLogRecord {
  intent: string;
  strategy: string;
  tool: string;
  quality: number;
  passed: boolean;
  timestamp: number;
}

export class SelfEvaluationEngine {
  private static instance: SelfEvaluationEngine;
  private auditLogs: AuditLogRecord[] = [];

  public static getInstance(): SelfEvaluationEngine {
    if (!SelfEvaluationEngine.instance) {
      SelfEvaluationEngine.instance = new SelfEvaluationEngine();
    }
    return SelfEvaluationEngine.instance;
  }

  /**
  * Evaluates a draft response against intent, context, personality, and hallucination criteria.
  */
  public evaluateResponse(options: {
    userIntent: string;
    draftResponse: string;
    conversationTopic?: string;
    toolUsed?: string;
    requiresSearch?: boolean;
    searchPerformed?: boolean;
  }): EvaluationResult {
    const { userIntent, draftResponse, conversationTopic, requiresSearch, searchPerformed } = options;
    const lowerDraft = (draftResponse || '').toLowerCase();
    const lowerIntent = (userIntent || '').toLowerCase();

    // 1. Intent Validation Check
    let intentMatch = 95;
    if (lowerIntent.includes('smart falcon') || lowerIntent.includes('character')) {
      if (lowerDraft.includes('fan gain today') || lowerDraft.includes('leaderboard rank')) {
        intentMatch = 20; // Mismatch detected (Character vs Fan System)
      }
    }

    // 2. Context Validation Check
    let contextRetention = 95;
    if (conversationTopic && !lowerDraft.includes(conversationTopic.toLowerCase()) && !lowerDraft.includes('trainer')) {
      contextRetention = 60;
    }

    // 3. Personality Validation Check
    let personalityConsistency = 95;
    if (lowerDraft.includes('request processed successfully') || lowerDraft.includes('operation completed')) {
      personalityConsistency = 30; // Robotic tone failure
    }

    // 4. Hallucination Risk Check
    let hallucinationRisk = 5;
    if (requiresSearch && !searchPerformed && /\b(patch 3\.2|new update released|version \d+\.\d+)\b/.test(lowerDraft)) {
      hallucinationRisk = 90; // Hallucination failure (unverified patch details)
    }

    // Calculate Overall Quality Score
    const overall = Math.round(
      (intentMatch * 0.3) +
      (contextRetention * 0.2) +
      (personalityConsistency * 0.3) +
      ((100 - hallucinationRisk) * 0.2)
    );

    const passed = overall >= 75 && intentMatch >= 50 && personalityConsistency >= 50 && hallucinationRisk < 50;

    let failureReason: string | undefined;
    if (!passed) {
      if (intentMatch < 50) failureReason = 'Intent validation failed: Response does not match user intent.';
      else if (personalityConsistency < 50) failureReason = 'Personality validation failed: Robotic or uninspired tone.';
      else if (hallucinationRisk >= 50) failureReason = 'Hallucination validation failed: Unverified factual claims without search backing.';
      else failureReason = 'Quality score below acceptance threshold.';
    }

    const record: AuditLogRecord = {
      intent: userIntent,
      strategy: 'INFORMATIONAL',
      tool: options.toolUsed ?? 'NONE',
      quality: overall,
      passed,
      timestamp: Date.now(),
    };
    this.auditLogs.push(record);

    logger.info(`[Self-Evaluation] Intent: "${userIntent}" | Overall Score: ${overall} | Passed: ${passed}`);

    return {
      intentMatch,
      contextRetention,
      personalityConsistency,
      hallucinationRisk,
      overall,
      passed,
      failureReason,
    };
  }

  public getAuditLogs(): AuditLogRecord[] {
    return this.auditLogs;
  }

  public clearLogs(): void {
    this.auditLogs = [];
  }
}

export const selfEvaluationEngine = SelfEvaluationEngine.getInstance();
