import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ModelHealthManager');

export interface ModelHealthState {
  model: string;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  disabledUntil: number | null;
  lastFailureReason: string | null;
  lastFailureAt: number | null;
  latencies: number[];
}

export interface AIReliabilityReport {
  successRatePercentage: number;
  averageLatencySeconds: number;
  totalRequests: number;
  successfulRequests: number;
  groqFailures: number;
  fallbackUsage: number;
  disabledModels: string[];
}

/**
 * ModelHealthManager — Circuit Breaker & Reliability Monitor for AI models.
 * - Disables models for 30 minutes if 5 consecutive failures occur.
 * - Immediately disables models if HTTP 404 (model not found/no access) is encountered.
 * - Automatically half-open probes after 30 minutes.
 * - Emits the hourly AI Reliability Report.
 */
export class ModelHealthManager {
  private static instance: ModelHealthManager;
  private modelStates: Map<string, ModelHealthState> = new Map();
  private totalRequests = 0;
  private successfulRequests = 0;
  private groqFailures = 0;
  private fallbackUsage = 0;
  private hourlyReportInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Schedule hourly AI Reliability Report (Issue 9)
    this.hourlyReportInterval = setInterval(() => {
      this.logReliabilityReport();
    }, 60 * 60 * 1000);
    if (this.hourlyReportInterval.unref) {
      this.hourlyReportInterval.unref();
    }
  }

  public static getInstance(): ModelHealthManager {
    if (!ModelHealthManager.instance) {
      ModelHealthManager.instance = new ModelHealthManager();
    }
    return ModelHealthManager.instance;
  }

  private getOrCreateState(model: string): ModelHealthState {
    let state = this.modelStates.get(model);
    if (!state) {
      state = {
        model,
        consecutiveFailures: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        disabledUntil: null,
        lastFailureReason: null,
        lastFailureAt: null,
        latencies: [],
      };
      this.modelStates.set(model, state);
    }
    return state;
  }

  /**
   * Checks if a model is currently healthy and not disabled by the circuit breaker.
   */
  public isModelHealthy(model: string): boolean {
    const state = this.getOrCreateState(model);
    if (state.disabledUntil) {
      if (Date.now() >= state.disabledUntil) {
        // Half-open state: cooldown expired, allow probing
        logger.info(
          `[ModelHealthManager] Circuit breaker cooldown expired for model "${model}". Half-open probe enabled.`
        );
        state.disabledUntil = null;
        state.consecutiveFailures = 0;
        return true;
      }
      return false; // Still within 30-minute disable period
    }
    return true;
  }

  /**
   * Records a successful execution for a model.
   */
  public recordSuccess(model: string, latencyMs: number): void {
    this.totalRequests++;
    this.successfulRequests++;

    const state = this.getOrCreateState(model);
    state.consecutiveFailures = 0;
    state.totalSuccesses++;
    state.disabledUntil = null;
    state.latencies.push(latencyMs);
    if (state.latencies.length > 50) {
      state.latencies.shift();
    }
  }

  /**
   * Records a failure for a model and triggers the circuit breaker if thresholds are met.
   */
  public recordFailure(model: string, reason: string, statusCode?: number): void {
    this.totalRequests++;
    this.groqFailures++;

    const state = this.getOrCreateState(model);
    state.consecutiveFailures++;
    state.totalFailures++;
    state.lastFailureReason = reason;
    state.lastFailureAt = Date.now();

    const isNotFound = statusCode === 404 || statusCode === 400 || /not found|does not exist|do not have access/i.test(reason);

    // Rule 1: Immediate disable for 404 (model does not exist / no access)
    if (isNotFound) {
      this.disableModel(model, 30 * 60 * 1000, `Model unavailable on Groq: ${reason}`);
      return;
    }

    // Rule 2: Circuit breaker for 5 consecutive failures
    if (state.consecutiveFailures >= 5) {
      this.disableModel(model, 30 * 60 * 1000, `5 consecutive failures: ${reason}`);
    }
  }

  /**
   * Explicitly disables a model for a specified duration (default 30 minutes).
   */
  public disableModel(model: string, durationMs = 30 * 60 * 1000, reason = 'Circuit breaker tripped'): void {
    const state = this.getOrCreateState(model);
    state.disabledUntil = Date.now() + durationMs;
    const minutes = Math.round(durationMs / 60000);
    logger.warn(
      `[ModelHealthManager] Circuit breaker TRIPPED for model "${model}". Disabled for ${minutes} minutes. Reason: ${reason}`
    );
  }

  /**
   * Records usage of the secondary fallback provider.
   */
  public recordFallbackUsage(): void {
    this.fallbackUsage++;
  }

  /**
   * Returns list of currently disabled models.
   */
  public getDisabledModels(): string[] {
    const disabled: string[] = [];
    const now = Date.now();
    for (const [model, state] of this.modelStates.entries()) {
      if (state.disabledUntil && state.disabledUntil > now) {
        disabled.push(model);
      }
    }
    return disabled;
  }

  /**
   * Computes the current AI Reliability Report.
   */
  public getReliabilityReport(): AIReliabilityReport {
    const allLatencies: number[] = [];
    for (const state of this.modelStates.values()) {
      allLatencies.push(...state.latencies);
    }
    const sumLatency = allLatencies.reduce((a, b) => a + b, 0);
    const avgLatencyMs = allLatencies.length > 0 ? sumLatency / allLatencies.length : 0;
    const avgLatencySec = parseFloat((avgLatencyMs / 1000).toFixed(1));

    const total = this.totalRequests || (this.successfulRequests + this.groqFailures) || 1;
    const successRate = parseFloat(((this.successfulRequests / total) * 100).toFixed(1));

    return {
      successRatePercentage: Math.min(100, Math.max(0, successRate)),
      averageLatencySeconds: avgLatencySec,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      groqFailures: this.groqFailures,
      fallbackUsage: this.fallbackUsage,
      disabledModels: this.getDisabledModels(),
    };
  }

  /**
   * Outputs the formatted hourly AI Reliability Report (Issue 9).
   */
  public logReliabilityReport(): void {
    const report = this.getReliabilityReport();
    const disabledText =
      report.disabledModels.length > 0
        ? `${report.disabledModels.length} (${report.disabledModels.join(', ')})`
        : '0';

    logger.info('==================================================');
    logger.info('AI Reliability Report');
    logger.info(`Success Rate: ${report.successRatePercentage}%`);
    logger.info(`Average Latency: ${report.averageLatencySeconds}s`);
    logger.info(`Groq Failures: ${report.groqFailures}`);
    logger.info(`Fallback Usage: ${report.fallbackUsage}`);
    logger.info(`Disabled Models: ${disabledText}`);
    logger.info('==================================================');
  }
}
