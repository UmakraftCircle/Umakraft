import { createLogger } from '@ai-agent-platform/shared';
import type { GenerateOptions, AIService } from './index.js';

const logger = createLogger('Providers');

// ── Custom HTTP error with status code ──

class HttpError extends Error {
  public statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

// ── Shared HTTP client (with timeout) ──

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

async function apiPost(
  url: string,
  headers: Record<string, string>,
  body: any,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new HttpError(response.status, `API request failed (${response.status}): ${errText}`);
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── OpenAI Provider (also used for OpenAI-compatible APIs like Groq) ──

export class OpenAIProvider implements AIService {
  private model: string;
  private keys: string[];
  private baseUrl: string;

  /**
   * @param apiKey   Single key, comma-separated keys ("k1,k2,k3"), or array
   * @param model    Model name (default: gpt-4o-mini)
   * @param baseUrl  API base URL (default: https://api.openai.com)
   */
  constructor(
    apiKey: string | string[],
    model: string = 'gpt-4o-mini',
    baseUrl: string = 'https://api.openai.com'
  ) {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // strip trailing slashes

    // Normalise: string → array, split comma-separated
    if (Array.isArray(apiKey)) {
      this.keys = apiKey.filter(Boolean);
    } else {
      this.keys = apiKey.split(',').map(k => k.trim()).filter(Boolean);
    }

    if (this.keys.length === 0) {
      throw new Error('OpenAIProvider requires at least one API key');
    }

    if (this.keys.length > 1) {
      logger.info(`OpenAIProvider: ${this.keys.length} keys loaded for rotation`);
    }
  }

  /** Pick a random key. Used across retries for rate-limit failover. */
  #pickKey(exclude?: string): string {
    const pool = exclude && this.keys.length > 1
      ? this.keys.filter(k => k !== exclude)
      : this.keys;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  public getCurrentModel(): string {
    return this.model;
  }

  // ── generate ────────────────────────────────────────────

  public async generate(options: GenerateOptions): Promise<string> {
    const messages: any[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    return this.#callWithRetry(messages, { temperature: 0.7 });
  }

  // ── generateStructuredOutput ─────────────────────────────

  public async generateStructuredOutput(options: GenerateOptions): Promise<any> {
    const messages: any[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    const raw = await this.#callWithRetry(messages, {
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    try {
      return JSON.parse(raw);
    } catch {
      logger.warn(`Failed to parse structured output as JSON. Raw: ${raw.slice(0, 200)}`);
      throw new Error('Structured output was not valid JSON.');
    }
  }

  // ── Internal: call with key rotation & rate-limit retry ─

  async #callWithRetry(
    messages: any[],
    extra: Record<string, any>,
  ): Promise<string> {
    let lastError: Error = new Error('No keys available for provider call');
    let lastUsedKey: string | undefined;

    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const key = this.#pickKey(lastUsedKey);
      lastUsedKey = key;
      const keySuffix = key.slice(-6);

      try {
        const result = await apiPost(
          `${this.baseUrl}/v1/chat/completions`,
          { Authorization: `Bearer ${key}` },
          { model: this.model, messages, ...extra }
        );
        return result.choices[0].message.content;
      } catch (err: any) {
        lastError = err;

        // Rate limit (429) → try next key if available
        const isRateLimit = err instanceof HttpError && err.statusCode === 429;

        if (isRateLimit && this.keys.length > 1 && attempt < this.keys.length - 1) {
          logger.warn(
            `Key ...${keySuffix} rate-limited (429), rotating to next key ` +
            `(attempt ${attempt + 2}/${this.keys.length})`
          );
          continue;
        }

        // Network timeout / abort → retry with different key
        const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';

        if (isTimeout && this.keys.length > 1 && attempt < this.keys.length - 1) {
          logger.warn(
            `Key ...${keySuffix} timed out, rotating to next key ` +
            `(attempt ${attempt + 2}/${this.keys.length})`
          );
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  }
}

// ── Anthropic Provider ──

export class AnthropicProvider implements AIService {
  private model: string;
  private baseUrl: string;

  constructor(
    private apiKey: string,
    model: string = 'claude-3-5-haiku',
  ) {
    this.model = model;
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  public getCurrentModel(): string {
    return this.model;
  }

  // ── generate ────────────────────────────────────────────

  public async generate(options: GenerateOptions): Promise<string> {
    return this.#callWithRetry({
      model: this.model,
      max_tokens: 4096,
      system: options.system || undefined,
      messages: [{ role: 'user', content: options.prompt }],
    });
  }

  // ── generateStructuredOutput ─────────────────────────────

  public async generateStructuredOutput(options: GenerateOptions): Promise<any> {
    const systemPrompt = (options.system || '') +
      '\n\nYou MUST respond with valid JSON only. No markdown, no commentary.';

    const raw = await this.#callWithRetry({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: options.prompt }],
    });

    try {
      return JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      logger.warn(`Failed to parse Anthropic structured output as JSON. Raw: ${raw.slice(0, 200)}`);
      throw new Error('Anthropic structured output was not valid JSON.');
    }
  }

  // ── Internal: call with retry on 429/timeout ────────────

  async #callWithRetry(body: any, attempt: number = 0): Promise<string> {
    const maxAttempts = 3;
    try {
      const result = await apiPost(
        this.baseUrl,
        {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body,
      );
      return result.content[0].text;
    } catch (err: any) {
      const isRetryable =
        (err instanceof HttpError && err.statusCode === 429) ||
        err.name === 'AbortError' ||
        err.name === 'TimeoutError';

      if (isRetryable && attempt < maxAttempts - 1) {
        const wait = 200 * Math.pow(2, attempt) + Math.random() * 100;
        logger.warn(
          `Anthropic ${this.model}: ${err.message}. Retrying (${attempt + 2}/${maxAttempts}) in ${Math.round(wait)}ms...`,
        );
        await new Promise(r => setTimeout(r, wait));
        return this.#callWithRetry(body, attempt + 1);
      }

      throw err;
    }
  }
}

// ── Factory ──

export type ProviderType = 'openai' | 'anthropic' | 'groq';

/**
 * Create an AI provider instance.
 *
 * Groq uses the OpenAI-compatible endpoint with key rotation.
 * Pass multiple keys as comma-separated: `GROQ_API_KEY=key1,key2,key3`
 */
export function createProvider(type: ProviderType, apiKey: string, model?: string): AIService {
  switch (type) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'groq':
      return new OpenAIProvider(
        apiKey,
        model || 'llama-3.3-70b-versatile',
        'https://api.groq.com/openai'
      );
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
