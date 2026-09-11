import { createLogger } from '@ai-agent-platform/shared';
import { GroqKeyManager, GroqKeyState } from './groq-key-manager.js';
import { GroqModelManager } from './groq-model-manager.js';
import { GroqHealthMonitor } from './groq-health-monitor.js';
import { ModelHealthManager } from './model-health-manager.js';

const logger = createLogger('GroqProvider');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqCallParams {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  queueLength?: number;
  intent?: string;
  messageLength?: number;
}

export interface GroqCallResult {
  content: string;
  keyIndex: number;
  model: string;
  latencyMs: number;
  retryCount: number;
  fallbackUsed: boolean;
  provider: string;
}

/**
 * GroqProvider — Production-grade Groq LLM executor.
 * Handles round-robin key selection, smart key failover, model fallback,
 * exponential backoff retry, circuit-breaker health integration, and intelligent routing.
 */
export class GroqProvider {
  private keyManager: GroqKeyManager;
  private modelManager: GroqModelManager;
  private healthMonitor: GroqHealthMonitor;
  private healthManager: ModelHealthManager;

  constructor(
    keyManager: GroqKeyManager,
    modelManager: GroqModelManager,
    healthMonitor: GroqHealthMonitor,
    healthManager?: ModelHealthManager
  ) {
    this.keyManager = keyManager;
    this.modelManager = modelManager;
    this.healthMonitor = healthMonitor;
    this.healthManager = healthManager || ModelHealthManager.getInstance();
  }

  public getKeyManager(): GroqKeyManager {
    return this.keyManager;
  }

  public getModelManager(): GroqModelManager {
    return this.modelManager;
  }

  public getHealthMonitor(): GroqHealthMonitor {
    return this.healthMonitor;
  }

  public getHealthManager(): ModelHealthManager {
    return this.healthManager;
  }

  public async call(params: GroqCallParams): Promise<GroqCallResult> {
    const startTime = Date.now();
    const models = this.modelManager.getPrioritizedModels({
      intent: params.intent,
      messageLength: params.messageLength,
    });
    const queueLen = params.queueLength ?? 0;

    if (this.keyManager.getKeyCount() === 0) {
      const err = new Error('No Groq API keys configured. Please set GROQ_API_KEYS or GROQ_API_KEY in environment.');
      logger.error(`[GroqProvider] ${err.message}`);
      throw err;
    }

    let totalAttempts = 0;
    const maxRetriesPerModel = 2;
    const failureHistory: string[] = [];

    for (const model of models) {
      // Circuit breaker check (Issue 4)
      if (!this.healthManager.isModelHealthy(model)) {
        logger.info(`[GroqProvider] Skipping model ${model} (currently disabled by circuit breaker).`);
        continue;
      }

      let modelAttempts = 0;

      while (modelAttempts < maxRetriesPerModel) {
        modelAttempts++;
        totalAttempts++;

        const keyState = this.keyManager.getNextKey();
        if (!keyState) {
          const msg = 'No Groq API keys available from key manager';
          logger.error(`[GroqProvider] ${msg}`);
          failureHistory.push(msg);
          break;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${keyState.key}`,
            },
            body: JSON.stringify({
              model,
              messages: params.messages,
              temperature: params.temperature ?? 0.7,
              max_tokens: params.maxTokens ?? 800,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errText = await response.text();
            const snippet = errText.slice(0, 150).replace(/\s+/g, ' ');

            // Authentication / Authorization Error (401 / 403)
            if (response.status === 401 || response.status === 403) {
              const msg = `Key ${keyState.keyIndex} (${keyState.maskedKey}) unauthorized (HTTP ${response.status}): ${snippet}`;
              logger.error(`[GroqProvider] ${msg}`);
              this.keyManager.recordFailure(keyState.keyIndex, msg);
              failureHistory.push(msg);
              continue;
            }

            // Rate Limit (429) or Server Error (5xx)
            if (response.status === 429 || response.status >= 500) {
              const msg = `Key ${keyState.keyIndex} (${keyState.maskedKey}) received HTTP ${response.status} on model ${model}: ${snippet}`;
              logger.warn(`[GroqProvider] ${msg}. Rotating to next key...`);
              this.keyManager.recordFailure(keyState.keyIndex, msg);
              this.healthManager.recordFailure(model, snippet, response.status);
              failureHistory.push(msg);

              if (modelAttempts < maxRetriesPerModel) {
                await this.applyBackoff(modelAttempts);
              }
              continue;
            }

            // Model decommissioned, not found, or unsupported (400 / 404)
            if (response.status === 400 || response.status === 404) {
              const msg = `Model ${model} returned HTTP ${response.status}: ${snippet}`;
              logger.warn(`[GroqProvider] ${msg}. Disabling model via circuit breaker and falling over...`);
              this.healthManager.recordFailure(model, snippet, response.status);
              failureHistory.push(msg);
              break; // advance to next model
            }

            const generalMsg = `Groq API error (HTTP ${response.status}): ${snippet}`;
            logger.warn(`[GroqProvider] ${generalMsg}`);
            this.healthManager.recordFailure(model, snippet, response.status);
            failureHistory.push(generalMsg);
            throw new Error(generalMsg);
          }

          const data: any = await response.json();
          const content = data?.choices?.[0]?.message?.content?.trim();

          if (!content) {
            throw new Error('Received empty content from Groq completion.');
          }

          const latencyMs = Date.now() - startTime;

          // Record successes
          this.keyManager.recordSuccess(keyState.keyIndex);
          this.healthManager.recordSuccess(model, latencyMs);

          this.healthMonitor.recordExecution({
            model,
            keyIndex: keyState.keyIndex,
            queueLength: queueLen,
            latencyMs,
            success: true,
            retries: totalAttempts - 1,
          });

          return {
            content,
            keyIndex: keyState.keyIndex,
            model,
            latencyMs,
            retryCount: totalAttempts - 1,
            fallbackUsed: false,
            provider: 'Groq',
          };
        } catch (err: any) {
          const isAbort = err.name === 'AbortError';
          const errMsg = isAbort ? 'Request timed out after 25s' : err.message;

          logger.warn(`[GroqProvider] Attempt ${totalAttempts} failed (Model=${model}, Key=${keyState.keyIndex}): ${errMsg}`);
          this.keyManager.recordFailure(keyState.keyIndex, errMsg);
          this.healthManager.recordFailure(model, errMsg);
          failureHistory.push(`Model ${model}, Key ${keyState.keyIndex}: ${errMsg}`);

          if (modelAttempts < maxRetriesPerModel) {
            await this.applyBackoff(modelAttempts);
          }
        }
      }
    }

    const totalLatencyMs = Date.now() - startTime;
    this.healthMonitor.recordExecution({
      model: models[0] || 'groq-unknown',
      keyIndex: 0,
      queueLength: queueLen,
      latencyMs: totalLatencyMs,
      success: false,
      retries: totalAttempts,
    });

    const rootCause = failureHistory.length > 0 ? failureHistory[failureHistory.length - 1] : 'Unknown error';
    logger.error(`[GroqProvider] All Groq attempts failed (${failureHistory.length} errors):\n - ${failureHistory.join('\n - ')}`);
    throw new Error(`All Groq API keys and models exhausted. Root cause: ${rootCause}`);
  }

  /**
   * Exponential backoff:
   * Attempt 1: wait 2s
   * Attempt 2: wait 4s
   */
  private async applyBackoff(attempt: number): Promise<void> {
    const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 6000);
    logger.info(`[GroqProvider] Exponential backoff: waiting ${delayMs}ms before retry...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

