import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ToolReliability');

export interface ToolHealthMetrics {
  slug: string;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  timeoutCalls: number;
  fallbackCalls: number;
  totalLatencyMs: number;
  isDegraded: boolean;
  lastFailureTime?: number;
}

export class ToolReliabilityEngine {
  private static instance: ToolReliabilityEngine;
  private healthMap: Map<string, ToolHealthMetrics> = new Map();
  private cacheMap: Map<string, { data: any; timestamp: number }> = new Map();

  // Fallback routing map
  private fallbackChain: Record<string, string> = {
    'umamusume-puredb-search': 'umamusume-data-miner',
    'umamusume-data-miner': 'cached-knowledge',
    'fan-tracker-api': 'fan-tracker-cache',
    'search_web': 'llm-reasoning',
  };

  public static getInstance(): ToolReliabilityEngine {
    if (!ToolReliabilityEngine.instance) {
      ToolReliabilityEngine.instance = new ToolReliabilityEngine();
    }
    return ToolReliabilityEngine.instance;
  }

  /**
   * Initializes or gets health metric record for a tool.
   */
  private getHealthMetric(slug: string): ToolHealthMetrics {
    if (!this.healthMap.has(slug)) {
      this.healthMap.set(slug, {
        slug,
        totalCalls: 0,
        successCalls: 0,
        failureCalls: 0,
        timeoutCalls: 0,
        fallbackCalls: 0,
        totalLatencyMs: 0,
        isDegraded: false,
      });
    }
    return this.healthMap.get(slug)!;
  }

  /**
   * Executes a tool function with Layer 1 Retry Engine, Layer 2 Fallback Routing,
   * Layer 3 Cached Knowledge support, and Layer 4 Graceful Failure handling.
   */
  public async executeWithReliability<T>(
    toolSlug: string,
    executeFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>,
    cacheKey?: string,
    maxRetries: number = 2
  ): Promise<T | null> {
    const metric = this.getHealthMetric(toolSlug);
    metric.totalCalls++;

    // Layer 3: Check cache if tool is currently degraded
    if (metric.isDegraded && cacheKey && this.cacheMap.has(cacheKey)) {
      const cached = this.cacheMap.get(cacheKey)!;
      logger.info(`[ToolReliability] Tool "${toolSlug}" is degraded. Serving cached result for key "${cacheKey}".`);
      metric.fallbackCalls++;
      return cached.data as T;
    }

    let attempt = 0;
    const startTime = Date.now();

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const result = await executeFn();
        const latency = Date.now() - startTime;

        metric.successCalls++;
        metric.totalLatencyMs += latency;

        // Save to cache if key provided
        if (cacheKey && result !== null && result !== undefined) {
          this.cacheMap.set(cacheKey, { data: result, timestamp: Date.now() });
        }

        // Recover degradation if success rate recovers
        if (metric.isDegraded && metric.successCalls / metric.totalCalls > 0.7) {
          metric.isDegraded = false;
          logger.info(`[ToolReliability] Tool "${toolSlug}" has recovered health status.`);
        }

        return result;
      } catch (err: any) {
        logger.warn(`[ToolReliability] Tool "${toolSlug}" attempt ${attempt}/${maxRetries + 1} failed: ${err?.message}`);

        if (attempt <= maxRetries) {
          const backoffMs = 150 * Math.pow(2, attempt - 1);
          await new Promise((res) => setTimeout(res, backoffMs));
        }
      }
    }

    // Mark attempt failures
    metric.failureCalls++;
    metric.lastFailureTime = Date.now();

    // Auto-degrade mode if failure rate > 30%
    if (metric.totalCalls >= 3 && metric.failureCalls / metric.totalCalls > 0.3) {
      metric.isDegraded = true;
      logger.error(`[ToolReliability] ALERT: Tool "${toolSlug}" marked DEGRADED (Failure rate: ${Math.round((metric.failureCalls / metric.totalCalls) * 100)}%).`);
    }

    // Layer 2: Execute Fallback Function
    if (fallbackFn) {
      metric.fallbackCalls++;
      try {
        logger.info(`[ToolReliability] Routing tool "${toolSlug}" to backup fallback chain: ${this.fallbackChain[toolSlug] || 'secondary-fn'}`);
        return await fallbackFn();
      } catch (fallbackErr: any) {
        logger.error(`[ToolReliability] Secondary fallback for "${toolSlug}" failed: ${fallbackErr?.message}`);
      }
    }

    // Layer 3: Serve Cached Result if Available
    if (cacheKey && this.cacheMap.has(cacheKey)) {
      logger.info(`[ToolReliability] Primary & Fallback failed. Serving last verified cached knowledge for key "${cacheKey}".`);
      return this.cacheMap.get(cacheKey)!.data as T;
    }

    return null;
  }

  /**
   * Returns formatted graceful user message when tool retrieval fails.
   */
  public getGracefulErrorMessage(): string {
    return 'I couldn\'t retrieve the latest trainer data right now. Please try again in a few minutes! 🐎';
  }

  /**
   * Returns all health metrics for diagnostic reporting.
   */
  public getAllHealthMetrics(): ToolHealthMetrics[] {
    return Array.from(this.healthMap.values());
  }
}

export const toolReliabilityEngine = ToolReliabilityEngine.getInstance();
