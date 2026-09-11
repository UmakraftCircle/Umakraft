import { createLogger } from '@ai-agent-platform/shared';
import { GroqKeyManager } from './groq-key-manager.js';
import { GroqModelManager } from './groq-model-manager.js';
import { LilyRequestQueue } from './request-queue.js';
import { GroqHealthMonitor, GroqExecutionMetrics } from './groq-health-monitor.js';
import { GroqProvider, ChatMessage, GroqCallResult } from './groq-provider.js';
import { ModelHealthManager } from './model-health-manager.js';
import { GroqModelDiscoveryService } from './groq-model-discovery.js';

const logger = createLogger('AIProviderManager');

export interface AIProviderResult extends GroqCallResult {
  emergencyModeActive?: boolean;
  fallbackProvider?: string;
  errorType?: string | null;
}

export interface ChatGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  intent?: string;
  messageLength?: number;
}

/**
 * AIProviderManager — Central enterprise provider hub.
 * Houses GroqProvider as the primary active engine with built-in concurrency queue,
 * dynamic model discovery, health manager / circuit breaker, and secondary platform fallback.
 */
export class AIProviderManager {
  private static instance: AIProviderManager;

  // Active Groq Provider subsystem
  private groqKeyManager: GroqKeyManager;
  private groqModelManager: GroqModelManager;
  private groqHealthMonitor: GroqHealthMonitor;
  private modelHealthManager: ModelHealthManager;
  private discoveryService: GroqModelDiscoveryService;
  private groqProvider: GroqProvider;
  private queue: LilyRequestQueue;

  private constructor() {
    this.groqKeyManager = new GroqKeyManager();
    this.discoveryService = GroqModelDiscoveryService.getInstance(this.groqKeyManager);
    this.modelHealthManager = ModelHealthManager.getInstance();
    this.groqModelManager = new GroqModelManager(this.discoveryService, this.modelHealthManager);
    this.groqHealthMonitor = new GroqHealthMonitor();
    this.queue = new LilyRequestQueue(2, 50); // Concurrency = 2

    this.groqProvider = new GroqProvider(
      this.groqKeyManager,
      this.groqModelManager,
      this.groqHealthMonitor,
      this.modelHealthManager
    );

    logger.info('[AIProviderManager] Initialized with GroqProvider and LilyRequestQueue (concurrency=2).');
  }

  public static getInstance(): AIProviderManager {
    if (!AIProviderManager.instance) {
      AIProviderManager.instance = new AIProviderManager();
    }
    return AIProviderManager.instance;
  }

  public getGroqProvider(): GroqProvider {
    return this.groqProvider;
  }

  public getQueue(): LilyRequestQueue {
    return this.queue;
  }

  public getHealthMonitor(): GroqHealthMonitor {
    return this.groqHealthMonitor;
  }

  public getModelHealthManager(): ModelHealthManager {
    return this.modelHealthManager;
  }

  public getDiscoveryService(): GroqModelDiscoveryService {
    return this.discoveryService;
  }

  /**
   * Dispatches chat request through concurrency queue to GroqProvider.
   * Emits precise telemetry recording provider, model, latency, fallbackUsed, errorType.
   */
  public async generateChat(
    messages: ChatMessage[],
    options?: ChatGenerationOptions
  ): Promise<AIProviderResult> {
    const startTime = Date.now();
    try {
      const result = await this.queue.enqueue(async () => {
        return await this.groqProvider.call({
          messages,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          intent: options?.intent,
          messageLength: options?.messageLength,
          queueLength: this.queue.getQueueLength(),
        });
      });

      // Telemetry record (Issue 5)
      logger.info(
        `[AIProviderManager] Telemetry: ${JSON.stringify({
          provider: 'Groq',
          success: true,
          fallbackUsed: false,
          fallbackProvider: null,
          model: result.model,
          latency: result.latencyMs,
          errorType: null,
        })}`
      );

      return {
        ...result,
        emergencyModeActive: false,
        errorType: null,
      };
    } catch (err: any) {
      const detailedErr = err?.message || 'Unknown provider error';
      logger.error(`[AIProviderManager] All Groq attempts failed. Root cause: ${detailedErr}`);

      const errorType = detailedErr.includes('404')
        ? 'HTTP_404'
        : detailedErr.includes('401') || detailedErr.includes('403')
        ? 'HTTP_401'
        : detailedErr.includes('429')
        ? 'HTTP_429'
        : 'API_ERROR';

      // Attempt fallback to platform standard AIService if available
      try {
        const fallbackKeys =
          process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
        if (fallbackKeys && fallbackKeys.trim().length > 0) {
          logger.info('[AIProviderManager] Attempting secondary fallback via platform AIService...');
          const { createProvider } = await import('@ai-agent-platform/ai');
          const fallbackProvider = createProvider('groq', fallbackKeys);
          const systemMsg = messages.find((m) => m.role === 'system')?.content;
          const userMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';

          const fallbackText = await fallbackProvider.generate({
            prompt: userMsg,
            system: systemMsg,
            maxTokens: options?.maxTokens ?? 600,
          });

          if (fallbackText && fallbackText.trim().length > 0) {
            const fallbackLatency = Date.now() - startTime;
            const activeFallbackModel = fallbackProvider.getCurrentModel();
            this.modelHealthManager.recordFallbackUsage();

            logger.info('[AIProviderManager] Secondary fallback succeeded.');

            // Telemetry record (Issue 5)
            logger.info(
              `[AIProviderManager] Telemetry: ${JSON.stringify({
                provider: 'Groq',
                success: true,
                fallbackUsed: true,
                fallbackProvider: 'OpenAIProvider',
                model: activeFallbackModel,
                latency: fallbackLatency,
                errorType,
              })}`
            );

            return {
              content: fallbackText.trim(),
              keyIndex: 1,
              model: activeFallbackModel,
              latencyMs: fallbackLatency,
              retryCount: 1,
              fallbackUsed: true,
              provider: 'Groq (OpenAIProvider Fallback)',
              fallbackProvider: 'OpenAIProvider',
              errorType,
              emergencyModeActive: false,
            };
          }
        }
      } catch (fallbackErr: any) {
        logger.error(`[AIProviderManager] Secondary fallback also failed: ${fallbackErr?.message}`);
      }

      const totalLatency = Date.now() - startTime;
      this.modelHealthManager.recordFallbackUsage();

      // Telemetry record for total failure (Issue 5)
      logger.info(
        `[AIProviderManager] Telemetry: ${JSON.stringify({
          provider: 'Groq',
          success: false,
          fallbackUsed: true,
          fallbackProvider: 'EmergencyFallback',
          model: 'emergency-fallback',
          latency: totalLatency,
          errorType,
        })}`
      );

      // Check if failure was caused by missing or invalid credentials
      const isMissingKeys = /no.*api key|missing.*key|not configured/i.test(detailedErr);
      const isAuthError = /401|403|unauthorized|invalid.*key/i.test(detailedErr);

      let emergencyContent =
        'Sorry, Trainer. My communication systems are currently overloaded. Please try again shortly.';
      if (isMissingKeys) {
        emergencyContent =
          'Trainer, my connection to the training track is currently offline because no `GROQ_API_KEYS` are configured. Please ask the server admin to verify the API credentials in Railway! 🐎';
      } else if (isAuthError) {
        emergencyContent =
          'Trainer, gate clearance was declined by the officials (API key invalid or expired). Please ask the server admin to verify `GROQ_API_KEYS` in Railway! 🐎';
      }

      return {
        content: emergencyContent,
        keyIndex: 0,
        model: 'emergency-fallback',
        latencyMs: totalLatency,
        retryCount: 3,
        fallbackUsed: true,
        provider: 'EmergencyFallback',
        fallbackProvider: 'EmergencyFallback',
        errorType,
        emergencyModeActive: true,
      };
    }
  }

  public getMetrics(): GroqExecutionMetrics & { queueLength: number; activeQueueCount: number } {
    const metrics = this.groqHealthMonitor.getMetrics();
    return {
      ...metrics,
      queueLength: this.queue.getQueueLength(),
      activeQueueCount: this.queue.getActiveCount(),
    };
  }
}

export const aiProviderManager = AIProviderManager.getInstance();

