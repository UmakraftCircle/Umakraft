import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('GroqHealthMonitor');

export interface GroqExecutionMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalRetries: number;
  averageLatencyMs: number;
  keyUsage: Record<number, number>;
  modelUsage: Record<string, number>;
}

/**
 * GroqHealthMonitor — Tracks real-time telemetry, model usage,
 * and outputs the required standardized diagnostic log line.
 */
export class GroqHealthMonitor {
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private totalRetries = 0;
  private latencyHistory: number[] = [];
  private keyUsage: Record<number, number> = {};
  private modelUsage: Record<string, number> = {};

  public recordExecution(params: {
    model: string;
    keyIndex: number;
    queueLength: number;
    latencyMs: number;
    success: boolean;
    retries?: number;
  }): void {
    this.totalRequests++;
    if (params.success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    if (params.retries && params.retries > 0) {
      this.totalRetries += params.retries;
    }

    this.keyUsage[params.keyIndex] = (this.keyUsage[params.keyIndex] || 0) + 1;
    this.modelUsage[params.model] = (this.modelUsage[params.model] || 0) + 1;

    this.latencyHistory.push(params.latencyMs);
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }

    const latencySec = (params.latencyMs / 1000).toFixed(1);

    // Required log format:
    // [LilyChatService] Model=qwen/qwen3-32b Key=3 Queue=1 Latency=1.2s Success=true
    logger.info(
      `[LilyChatService] Model=${params.model} Key=${params.keyIndex} Queue=${params.queueLength} Latency=${latencySec}s Success=${params.success}`
    );
  }

  public getMetrics(): GroqExecutionMetrics {
    const sumLatency = this.latencyHistory.reduce((a, b) => a + b, 0);
    const avgLatency = this.latencyHistory.length > 0 ? Math.round(sumLatency / this.latencyHistory.length) : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      totalRetries: this.totalRetries,
      averageLatencyMs: avgLatency,
      keyUsage: { ...this.keyUsage },
      modelUsage: { ...this.modelUsage },
    };
  }
}
