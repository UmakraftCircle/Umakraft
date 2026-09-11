import { createLogger } from '@ai-agent-platform/shared';
import { IntentType } from './intent-router.js';

const logger = createLogger('ObservabilityTelemetry');

export interface RequestTrace {
  traceId: string;
  userId: string;
  intent?: IntentType;
  intentConfidence?: number;
  intentSource?: string;
  model?: string;
  provider?: string;
  cacheStatus?: 'HIT' | 'MISS' | 'REJECTED';
  cacheKey?: string;
  memoryCountLoaded?: number;
  contextTokens?: number;
  evaluationScore?: number;
  evaluationPassed?: boolean;
  durationMs?: number;
  outcome?: 'SENT' | 'REGENERATED' | 'FALLBACK_RESPONSE';
  toolExecution?: {
    toolName: string;
    success: boolean;
    durationMs: number;
    error?: string;
  }[];
  timestamp: number;
}

export class ObservabilityService {
  private static instance: ObservabilityService;
  private traces: Map<string, RequestTrace> = new Map();
  private recentTraceIds: string[] = [];

  public static getInstance(): ObservabilityService {
    if (!ObservabilityService.instance) {
      ObservabilityService.instance = new ObservabilityService();
    }
    return ObservabilityService.instance;
  }

  public startTrace(userId: string): RequestTrace {
    const dateStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const randomNum = Math.floor(Math.random() * 900000) + 100000;
    const traceId = `REQ-${dateStr}-${randomNum}`;

    const trace: RequestTrace = {
      traceId,
      userId,
      timestamp: Date.now(),
      toolExecution: [],
    };

    this.traces.set(traceId, trace);
    this.recentTraceIds.push(traceId);
    if (this.recentTraceIds.length > 500) {
      const oldId = this.recentTraceIds.shift();
      if (oldId) this.traces.delete(oldId);
    }

    logger.info(`[${traceId}] Started trace for user ${userId}`);
    return trace;
  }

  public getTrace(traceId: string): RequestTrace | undefined {
    return this.traces.get(traceId);
  }

  public logIntent(traceId: string, intent: IntentType, confidence: number, source: string): void {
    const t = this.traces.get(traceId);
    if (!t) return;
    t.intent = intent;
    t.intentConfidence = confidence;
    t.intentSource = source;
    logger.info(`[${traceId}] Intent Detection -> Detected: ${intent}, Confidence: ${confidence}, Method: ${source}`);
  }

  public logContext(traceId: string, loadedItems: string[], skippedItems: string[], tokenEstimate: number): void {
    const t = this.traces.get(traceId);
    if (!t) return;
    t.contextTokens = tokenEstimate;
    logger.info(`[${traceId}] Context Builder -> Loaded: [${loadedItems.join(', ')}], Skipped: [${skippedItems.join(', ')}], Tokens: ${tokenEstimate}`);
  }

  public logMemory(traceId: string, loadedKeys: string[], count: number): void {
    const t = this.traces.get(traceId);
    if (!t) return;
    t.memoryCountLoaded = count;
    logger.info(`[${traceId}] Memory Retrieval -> Loaded keys: [${loadedKeys.join(', ')}], Count: ${count}`);
  }

  public logCache(traceId: string, status: 'HIT' | 'MISS' | 'REJECTED', key?: string, reason?: string): void {
    const t = this.traces.get(traceId);
    if (!t) return;
    t.cacheStatus = status;
    t.cacheKey = key;
    logger.info(`[${traceId}] Cache Status -> Status: ${status}${key ? `, Key: ${key}` : ''}${reason ? `, Reason: ${reason}` : ''}`);
  }

  public logTool(traceId: string, toolName: string, success: boolean, durationMs: number, error?: string): void {
    const t = this.traces.get(traceId);
    if (!t) return;
    if (!t.toolExecution) t.toolExecution = [];
    t.toolExecution.push({ toolName, success, durationMs, error });
    logger.info(`[${traceId}] Tool Execution -> Tool: ${toolName}, Success: ${success}, Duration: ${durationMs}ms${error ? `, Error: ${error}` : ''}`);
  }

  public logModel(traceId: string, model: string, provider: string, promptTokens: number, respTokens: number, durationMs: number): void {
    const t = this.traces.get(traceId);
    if (!t) return;
    t.model = model;
    t.provider = provider;
    t.durationMs = durationMs;
    logger.info(`[${traceId}] Model Execution -> Model: ${model}, Provider: ${provider}, PromptTokens: ${promptTokens}, RespTokens: ${respTokens}, Duration: ${durationMs}ms`);
  }

  public logEvaluator(traceId: string, passed: boolean, score: number, reasons: string[]): void {
    const t = this.traces.get(traceId);
    if (!t) return;
    t.evaluationPassed = passed;
    t.evaluationScore = score;
    logger.info(`[${traceId}] Evaluation -> Passed: ${passed}, Score: ${score}, Reasons: [${reasons.join(', ')}]`);
  }

  public finalizeTrace(traceId: string, outcome: 'SENT' | 'REGENERATED' | 'FALLBACK_RESPONSE'): void {
    const t = this.traces.get(traceId);
    if (!t) return;
    t.outcome = outcome;
    logger.info(`[${traceId}] Result -> Outcome: ${outcome}`);
  }

  public getHealthReport(): string {
    const total = this.recentTraceIds.length;
    if (total === 0) return '=== Lily Health Report ===\nNo requests traced yet.';

    let passedCount = 0;
    let cacheHits = 0;
    let regeneratedCount = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const id of this.recentTraceIds) {
      const t = this.traces.get(id);
      if (!t) continue;
      if (t.evaluationPassed) passedCount++;
      if (t.cacheStatus === 'HIT') cacheHits++;
      if (t.outcome === 'REGENERATED') regeneratedCount++;
      if (t.durationMs) {
        totalDuration += t.durationMs;
        durationCount++;
      }
    }

    const accuracy = ((passedCount / total) * 100).toFixed(1);
    const cacheHitRate = ((cacheHits / total) * 100).toFixed(1);
    const avgDuration = durationCount > 0 ? (totalDuration / durationCount).toFixed(0) : '0';

    return `=== Lily Health Report ===\nRequests Traced: ${total}\nEvaluation Accuracy: ${accuracy}%\nCache Hit Rate: ${cacheHitRate}%\nRegenerations: ${regeneratedCount}\nAvg Response Time: ${avgDuration}ms`;
  }
}

export const observabilityService = ObservabilityService.getInstance();
