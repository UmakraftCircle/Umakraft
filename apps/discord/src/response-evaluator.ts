import { createLogger } from '@ai-agent-platform/shared';
import { IntentType } from './intent-router.js';

const logger = createLogger('ResponseEvaluatorService');

export interface EvaluationResult {
  passed: boolean;
  score: number; // 0-100
  intentMatch: boolean;
  coverageScore: boolean;
  dataAccuracy: boolean;
  formatValid: boolean;
  reasons: string[];
}

export class ResponseEvaluatorService {
  private static instance: ResponseEvaluatorService;

  public static getInstance(): ResponseEvaluatorService {
    if (!ResponseEvaluatorService.instance) {
      ResponseEvaluatorService.instance = new ResponseEvaluatorService();
    }
    return ResponseEvaluatorService.instance;
  }

  /**
  * G5 Response Evaluator: Evaluates generated responses across 6 core layers
  * (Intent Alignment, Coverage, Hallucination/Data Accuracy, Tool/Source Verification, Safety, and Confidence Scoring).
  */
  public evaluate(options: {
    userMessage: string;
    expectedIntent: IntentType;
    generatedResponse: string;
    sourceData?: Record<string, any>;
  }): EvaluationResult {
    const { userMessage, expectedIntent, generatedResponse, sourceData } = options;
    const lowerMsg = (userMessage || '').toLowerCase();
    const lowerResp = (generatedResponse || '').toLowerCase();

    let intentMatch = true;
    let coverageScore = true;
    let dataAccuracy = true;
    let formatValid = true;
    const reasons: string[] = [];

    // Layer 5: Safety Check (Prompt leaks, empty outputs, garbage)
    if (!generatedResponse || generatedResponse.trim().length === 0) {
      return {
        passed: false,
        score: 0,
        intentMatch: false,
        coverageScore: false,
        dataAccuracy: false,
        formatValid: false,
        reasons: ['Response is empty.'],
      };
    }

    if (lowerResp.includes('system prompt:') || lowerResp.includes('you are lily...')) {
      logger.warn('[ResponseEvaluator] Prompt leakage detected in response.');
      return {
        passed: false,
        score: 0,
        intentMatch: false,
        coverageScore: false,
        dataAccuracy: true,
        formatValid: false,
        reasons: ['Prompt leakage detected.'],
      };
    }

    // Layer 1: Intent Alignment
    if (expectedIntent === IntentType.CHAT && (lowerMsg.includes('yamanin zephyr') || lowerMsg.includes('bust size'))) {
      if (lowerResp.includes('queen elizabeth cup') || lowerResp.includes('track layout') || lowerResp.includes('fan gain today')) {
        intentMatch = false;
        reasons.push('IntentMismatch: Character query incorrectly answered with track/leaderboard data.');
      }
    }

    if (expectedIntent === IntentType.LEADERBOARD && !/\b(rank|leaderboard|standing|position|fans?)\b/i.test(lowerResp)) {
      intentMatch = false;
      reasons.push('IntentMismatch: Leaderboard response missing ranking terminology.');
    }

    // Layer 2: Question Coverage
    if (lowerMsg.includes('fan gain') && !/\b(fans?|gain|today|million)\b/i.test(lowerResp)) {
      coverageScore = false;
      reasons.push('CoverageLow: Fan gain question not adequately covered.');
    }

    // Layer 3 & 4: Hallucination & Source Data Verification
    if (sourceData && sourceData.rank !== undefined) {
      const sourceRank = sourceData.rank;
      const respMatch = lowerResp.match(/rank\s*(?:#|is)?\s*(\d+)/i);
      if (respMatch && respMatch[1]) {
        const statedRank = parseInt(respMatch[1], 10);
        if (statedRank !== sourceRank) {
          dataAccuracy = false;
          reasons.push(`HallucinationDetected: Stated rank (${statedRank}) does not match source rank (${sourceRank}).`);
        }
      }
    }

    // Calculate score (25 points per dimension)
    let score = 100;
    if (!intentMatch) score -= 25;
    if (!coverageScore) score -= 25;
    if (!dataAccuracy) score -= 25;
    if (!formatValid) score -= 25;

    const passed = score >= 75 && intentMatch && dataAccuracy;

    if (!passed) {
      logger.warn(`[ResponseEvaluator] Response failed evaluation (score: ${score}). Reasons: ${reasons.join(', ')}`);
    } else {
      logger.info(`[ResponseEvaluator] Response passed evaluation with score ${score}/100.`);
    }

    return {
      passed,
      score,
      intentMatch,
      coverageScore,
      dataAccuracy,
      formatValid,
      reasons,
    };
  }
}

export const responseEvaluatorService = ResponseEvaluatorService.getInstance();
