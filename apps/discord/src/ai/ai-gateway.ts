import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('AIModelStrategy');

export enum TaskType {
  INTENT_CLASSIFICATION = 'INTENT_CLASSIFICATION',
  TOOL_PLANNING = 'TOOL_PLANNING',
  MEMORY_EXTRACTION = 'MEMORY_EXTRACTION',
  CHAT = 'CHAT',
  HANDBOOK_SUMMARY = 'HANDBOOK_SUMMARY',
  RESPONSE_EVALUATION = 'RESPONSE_EVALUATION',
  WEB_REASONING = 'WEB_REASONING',
}

export interface ModelProfile {
  modelName: string;
  provider: 'Groq' | 'OpenRouter' | 'Backup';
  isFastModel: boolean;
  maxTokens: number;
}

export class KeyPoolManager {
  private static instance: KeyPoolManager;
  private groqKeys: string[] = ['groq-key-1', 'groq-key-2', 'groq-key-3'];
  private currentIndex = 0;

  public static getInstance(): KeyPoolManager {
    if (!KeyPoolManager.instance) {
      KeyPoolManager.instance = new KeyPoolManager();
    }
    return KeyPoolManager.instance;
  }

  public getNextGroqKey(): string {
    if (this.groqKeys.length === 0) return 'default-groq-key';
    const key = this.groqKeys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.groqKeys.length;
    return key;
  }
}

export class UsageTracker {
  private static instance: UsageTracker;
  private usage: Map<TaskType, { calls: number; tokens: number }> = new Map();

  public static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  public track(taskType: TaskType, tokens: number): void {
    const current = this.usage.get(taskType) || { calls: 0, tokens: 0 };
    current.calls += 1;
    current.tokens += tokens;
    this.usage.set(taskType, current);
    logger.info(`[UsageTracker] Task=${taskType} Calls=${current.calls} Tokens=${current.tokens}`);
  }

  public getUsageReport(): Record<string, { calls: number; tokens: number }> {
    const result: Record<string, { calls: number; tokens: number }> = {};
    for (const [k, v] of this.usage.entries()) {
      result[k] = { ...v };
    }
    return result;
  }
}

export class LatencyTracker {
  private static instance: LatencyTracker;
  private latencies: Map<string, number[]> = new Map();

  public static getInstance(): LatencyTracker {
    if (!LatencyTracker.instance) {
      LatencyTracker.instance = new LatencyTracker();
    }
    return LatencyTracker.instance;
  }

  public record(model: string, latencyMs: number): void {
    const list = this.latencies.get(model) || [];
    list.push(latencyMs);
    if (list.length > 100) list.shift();
    this.latencies.set(model, list);
  }

  public getAverageLatency(model: string): number {
    const list = this.latencies.get(model);
    if (!list || list.length === 0) return 0;
    const sum = list.reduce((a, b) => a + b, 0);
    return Math.round(sum / list.length);
  }
}

export class ModelRouter {
  private static instance: ModelRouter;

  public static getInstance(): ModelRouter {
    if (!ModelRouter.instance) {
      ModelRouter.instance = new ModelRouter();
    }
    return ModelRouter.instance;
  }

  public route(taskType: TaskType): ModelProfile {
    switch (taskType) {
      case TaskType.INTENT_CLASSIFICATION:
      case TaskType.TOOL_PLANNING:
      case TaskType.MEMORY_EXTRACTION:
      case TaskType.RESPONSE_EVALUATION:
        return {
          modelName: 'openai/gpt-oss-safeguard-20b',
          provider: 'Groq',
          isFastModel: true,
          maxTokens: 500,
        };
      case TaskType.CHAT:
      case TaskType.HANDBOOK_SUMMARY:
      case TaskType.WEB_REASONING:
      default:
        return {
          modelName: 'llama-3.3-70b-versatile',
          provider: 'Groq',
          isFastModel: false,
          maxTokens: 2000,
        };
    }
  }
}

export class ProviderManager {
  private static instance: ProviderManager;

  public static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  public executeWithFailover<T>(taskType: TaskType, operation: (profile: ModelProfile, apiKey: string) => T): T {
    const router = ModelRouter.getInstance();
    const keyPool = KeyPoolManager.getInstance();
    const profile = router.route(taskType);
    const apiKey = keyPool.getNextGroqKey();

    try {
      // Primary: Groq execution
      return operation(profile, apiKey);
    } catch (err) {
      logger.warn(`[ProviderManager] Groq provider failed for ${taskType}. Failing over to OpenRouter secondary...`);
      try {
        const secondaryProfile: ModelProfile = { ...profile, provider: 'OpenRouter', modelName: 'qwen/qwen-2.5-72b-instruct' };
        return operation(secondaryProfile, 'openrouter-backup-key');
      } catch (secondaryErr) {
        logger.error(`[ProviderManager] Secondary provider also failed. Triggering emergency mode.`);
        throw new Error('Trainer, Lily is currently experiencing connection issues. Please try again in a moment.');
      }
    }
  }
}

export class AIGatewayService {
  private static instance: AIGatewayService;

  public static getInstance(): AIGatewayService {
    if (!AIGatewayService.instance) {
      AIGatewayService.instance = new AIGatewayService();
    }
    return AIGatewayService.instance;
  }

  public call(taskType: TaskType, prompt: string): { response: string; modelUsed: string; tokensUsed: number; durationMs: number } {
    const providerManager = ProviderManager.getInstance();
    const usageTracker = UsageTracker.getInstance();
    const latencyTracker = LatencyTracker.getInstance();
    const start = Date.now();

    const result = providerManager.executeWithFailover(taskType, (profile, apiKey) => {
      // Simulate intelligent model response generation
      const mockResponse = `[AI Gateway Reply via ${profile.provider}:${profile.modelName}] Processed task ${taskType}`;
      const tokens = Math.floor(prompt.length / 4) + 100;
      return { response: mockResponse, model: profile.modelName, tokens };
    });

    const duration = Date.now() - start;
    usageTracker.track(taskType, result.tokens);
    latencyTracker.record(result.model, duration);

    logger.info(`[AIGateway] Task=${taskType} Model=${result.model} Duration=${duration}ms Tokens=${result.tokens}`);

    return {
      response: result.response,
      modelUsed: result.model,
      tokensUsed: result.tokens,
      durationMs: duration,
    };
  }
}

export const aiGatewayService = AIGatewayService.getInstance();
export const usageTracker = UsageTracker.getInstance();
export const latencyTracker = LatencyTracker.getInstance();
