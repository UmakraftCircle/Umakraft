import { createLogger } from '@ai-agent-platform/shared';
import { intentRouterService, IntentType } from './intent-router.js';
import { contextBuilderService } from './context-builder.js';
import { smartCacheService } from './smart-cache.js';
import { memoryManagerService } from './memory-manager.js';
import { responseEvaluatorService, EvaluationResult } from './response-evaluator.js';
import { observabilityService } from './observability.js';
import { promptService } from './prompt-service.js';
import { aiPlanner } from './tools/ai-planner.js';
import { toolRegistry } from './tools/tool-registry.js';

const logger = createLogger('LilyOrchestrator');

export interface MessageRequest {
  userId: string;
  message: string;
  recentMessages?: string[];
}

export interface MessageResponse {
  reply: string;
  traceId: string;
  evaluation: EvaluationResult;
}

export class LilyOrchestrator {
  private static instance: LilyOrchestrator;

  public static getInstance(): LilyOrchestrator {
    if (!LilyOrchestrator.instance) {
      LilyOrchestrator.instance = new LilyOrchestrator();
    }
    return LilyOrchestrator.instance;
  }

  /**
  * Main orchestration pipeline uniting G1-G5, H1 Observability, and H3 Tool Agent Framework.
  */
  public handleMessage(request: MessageRequest): MessageResponse {
    const trace = observabilityService.startTrace(request.userId);
    const start = Date.now();

    // 1. G1 Intent Routing
    const intentResult = intentRouterService.route(request.message);
    observabilityService.logIntent(trace.traceId, intentResult.intent, intentResult.confidence, intentResult.source);

    // 2. G4 Memory Extraction & Retrieval
    const extractedMemories = memoryManagerService.classifyAndExtract(request.userId, request.message);
    const trainerMemories = memoryManagerService.getAllTrainerMemories(request.userId);
    observabilityService.logMemory(trace.traceId, Object.keys(trainerMemories), Object.keys(trainerMemories).length);

    // 3. G3 Smart Cache Lookup (Intent-Aware & Trainer-Scoped)
    const cachedData = smartCacheService.get({
      intent: intentResult.intent,
      query: request.message,
      trainerId: request.userId,
      similarity: 0.90,
    });

    if (cachedData) {
      observabilityService.logCache(trace.traceId, 'HIT', request.message);
      const evalResult = responseEvaluatorService.evaluate({
        userMessage: request.message,
        expectedIntent: intentResult.intent,
        generatedResponse: typeof cachedData === 'string' ? cachedData : JSON.stringify(cachedData),
      });
      observabilityService.logEvaluator(trace.traceId, evalResult.passed, evalResult.score, evalResult.reasons);
      observabilityService.finalizeTrace(trace.traceId, 'SENT');
      return {
        reply: typeof cachedData === 'string' ? cachedData : JSON.stringify(cachedData),
        traceId: trace.traceId,
        evaluation: evalResult,
      };
    } else {
      observabilityService.logCache(trace.traceId, 'MISS');
    }

    // 4. H3 AI Planner & Tool Execution
    const plannedTools = aiPlanner.plan(intentResult.intent, request.message);
    let toolResultData: any = null;
    let primaryToolName = 'None';

    if (plannedTools.length > 0) {
      primaryToolName = plannedTools[0];
      const tool = toolRegistry.getTool(primaryToolName);
      if (tool) {
        const tResult = tool.execute({
          trainerId: request.userId,
          query: request.message,
          intent: intentResult.intent,
        });
        toolResultData = tResult.data;
        observabilityService.logTool(trace.traceId, tResult.toolName, tResult.success, tResult.durationMs, tResult.error);
      }
    }

    // 5. G2 Context Building
    const context = contextBuilderService.buildContext({
      intent: intentResult.intent,
      userMessage: request.message,
      trainerId: request.userId,
      recentMessages: request.recentMessages,
      trainerProfile: trainerMemories,
      fanStats: primaryToolName === 'FanGainTool' ? toolResultData : undefined,
      leaderboardData: primaryToolName === 'LeaderboardTool' ? toolResultData : undefined,
      handbookSnippets: primaryToolName === 'HandbookTool' ? toolResultData?.handbookSnippets : undefined,
    });
    observabilityService.logContext(trace.traceId, Object.keys(context), [], context.tokenEstimate);

    // 6. Prompt Generation & Formatting Layer
    const prompt = promptService.buildPrompt(intentResult.intent, toolResultData);
    let generatedReply = `Hello Trainer! In response to "${request.message}": `;
    if (primaryToolName === 'FanGainTool' && toolResultData) {
      generatedReply += `Your current fan count is ${toolResultData.currentFans?.toLocaleString() ?? 0} with a daily gain of ${toolResultData.dailyGain?.toLocaleString() ?? 0}.`;
    } else if (primaryToolName === 'LeaderboardTool' && toolResultData) {
      generatedReply += `You are currently rank #${toolResultData.rank} on the club leaderboard.`;
    } else if (primaryToolName === 'HandbookTool' && toolResultData?.handbookSnippets) {
      generatedReply += `Handbook rule: ${toolResultData.handbookSnippets[0] || 'Club rules apply.'}`;
    } else {
      generatedReply += `I am here to support your Umakraft training journey!`;
    }

    const duration = Date.now() - start;
    observabilityService.logModel(trace.traceId, 'gemini-3.5-flash-lite', 'Google AI', 1200, 150, duration);

    // 7. G5 Response Evaluation (Quality Gate)
    const evalResult = responseEvaluatorService.evaluate({
      userMessage: request.message,
      expectedIntent: intentResult.intent,
      generatedResponse: generatedReply,
      sourceData: toolResultData,
    });
    observabilityService.logEvaluator(trace.traceId, evalResult.passed, evalResult.score, evalResult.reasons);

    let outcome: 'SENT' | 'REGENERATED' | 'FALLBACK_RESPONSE' = 'SENT';
    let finalReply = generatedReply;

    if (!evalResult.passed) {
      outcome = 'FALLBACK_RESPONSE';
      finalReply = "Sorry Trainer, I couldn't confidently answer that request right now.";
      logger.warn(`[LilyOrchestrator] Response failed evaluation. Triggered fallback response.`);
    }

    observabilityService.finalizeTrace(trace.traceId, outcome);

    // Cache if appropriate
    if (evalResult.passed) {
      smartCacheService.put({
        intent: intentResult.intent,
        query: request.message,
        data: finalReply,
        trainerId: request.userId,
      });
    }

    return {
      reply: finalReply,
      traceId: trace.traceId,
      evaluation: evalResult,
    };
  }
}

export const lilyOrchestrator = LilyOrchestrator.getInstance();
