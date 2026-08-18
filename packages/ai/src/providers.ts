import { createLogger } from '@ai-agent-platform/shared';
import type { GenerateOptions, AIService } from './index.js';
import { LocalProvider } from './local-provider.js';

const logger = createLogger('Providers');

class HttpError extends Error {
  public statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;

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

function isToolUseFailed(err: any): boolean {
  if (!(err instanceof HttpError)) return false;
  // A 400 with `tool_use_failed` is a CONFIGURATION error (models emitting
  // native tool-call tokens with no tools registered). Retrying the SAME
  // request would hit the same 400 forever — it must be surfaced, not retried.
  return err.statusCode === 400 && /tool_use_failed|Tool choice is none|json_validate_failed/.test(err.message);
}

// Groq model candidates for /ask tool-calling. `openai/gpt-oss-20b` is the smaller
// sibling of the 120b reasoning model already proven to work on this account, and
// follows JSON instructions far more reliably. Source of truth: GET /models.
const GROQ_MODEL_CANDIDATES: string[] = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
];

// Keys that would cause Groq/OpenAI to interpret output as a native tool call.
// We never register API-level tools; if the model emits these we must reject the
// response locally rather than let the gateway 400 (or loop).
const NATIVE_TOOL_KEYS = ['name', 'arguments', 'tool_calls', 'function'];

function hasNativeToolCall(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return NATIVE_TOOL_KEYS.some((k) => k in (obj as Record<string, unknown>));
}

export class OpenAIProvider implements AIService {
  private model: string;
  private keys: string[];
  private baseUrl: string;

  constructor(
    apiKey: string | string[],
    model: string = 'gpt-4o-mini',
    baseUrl: string = 'https://api.openai.com',
  ) {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, '');

    if (Array.isArray(apiKey)) {
      this.keys = apiKey.filter(Boolean);
    } else {
      this.keys = apiKey.split(',').map((k) => k.trim()).filter(Boolean);
    }

    if (this.keys.length === 0) {
      throw new Error('OpenAIProvider requires at least one API key');
    }

    if (this.keys.length > 1) {
      logger.info(`OpenAIProvider: ${this.keys.length} keys loaded for rotation`);
    }
  }

  public getCurrentModel(): string {
    return this.model;
  }

  public async generate(options: GenerateOptions): Promise<string> {
    const messages: any[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });
    return this.#callWithRetry(messages, { temperature: 0.7 });
  }

  public async generateStructuredOutput(options: GenerateOptions): Promise<any> {
    const messages: any[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    const raw = await this.#callWithRetry(messages, { temperature: 0.3 }, { allowRetryOn400: false });

    try {
      const parsed = JSON.parse(raw);
      // Defensive: if the model emitted a native tool-call shape, reject locally
      // instead of kicking it back to the API (which would 400/loop).
      if (hasNativeToolCall(parsed)) {
        logger.warn('Model emitted a native tool-call shape; treating as invalid structured output.');
        throw new Error('Native tool-call output is not supported in this mode.');
      }
      return parsed;
    } catch {
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) {
        try {
          const parsed = JSON.parse(fence[1].trim());
          if (hasNativeToolCall(parsed)) throw new Error('native tool-call');
          return parsed;
        } catch {}
      }
      const objectMatch = raw.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          const parsed = JSON.parse(objectMatch[0]);
          if (hasNativeToolCall(parsed)) throw new Error('native tool-call');
          return parsed;
        } catch {}
      }
      logger.warn(`Failed to parse structured output as JSON. Raw: ${raw.slice(0, 200)}`);
      throw new Error('Structured output was not valid JSON.');
    }
  }

  async #callWithRetry(
    messages: any[],
    extra: Record<string, any>,
    opts: { allowRetryOn400?: boolean } = {},
  ): Promise<string> {
    let lastError: Error = new Error('No keys available for provider call');
    const triedKeys = new Set<string>();

    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const pool = triedKeys.size > 0 ? this.keys.filter((k) => !triedKeys.has(k)) : this.keys;
      const key = pool[Math.floor(Math.random() * pool.length)];
      triedKeys.add(key);
      const keySuffix = key.slice(-6);

      try {
        const result = await apiPost(
          `${this.baseUrl}/v1/chat/completions`,
          { Authorization: `Bearer ${key}` },
          { model: this.model, messages, ...extra },
        );
        const content = result.choices[0].message.content;
        // Groq-specific: if the model called a tool, it lands in `tool_calls`,
        // and `content` is null. Surface this clearly instead of returning null.
        if (content == null) {
          const tc = result.choices[0]?.message?.tool_calls;
          throw new Error(`Model returned no text content${tc ? ' and attempted a tool call' : ''}.`);
        }
        return content;
      } catch (err: any) {
        lastError = err;

        // Configuration error (400 tool_use_failed / json_validate_failed) must
        // NOT be blindly retried — retrying the same request cannot fix it.
        if (isToolUseFailed(err) || (opts.allowRetryOn400 === false && err instanceof HttpError && err.statusCode === 400)) {
          logger.error(`Provider config/validation error (no retry): ${err.message}`);
          throw err;
        }

        const isRateLimit = err instanceof HttpError && err.statusCode === 429;
        if (isRateLimit && triedKeys.size < this.keys.length) {
          logger.warn(`Key ...${keySuffix} rate-limited (429), rotating to next key (attempt ${attempt + 2}/${this.keys.length})`);
          continue;
        }
        const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
        if (isTimeout && triedKeys.size < this.keys.length) {
          logger.warn(`Key ...${keySuffix} timed out, rotating to next key (attempt ${attempt + 2}/${this.keys.length})`);
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }
}

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

  public async generate(options: GenerateOptions): Promise<string> {
    return this.#callWithRetry({
      model: this.model,
      max_tokens: 4096,
      system: options.system || undefined,
      messages: [{ role: 'user', content: options.prompt }],
    });
  }

  public async generateStructuredOutput(options: GenerateOptions): Promise<any> {
    const systemPrompt = (options.system || '') + '\n\nYou MUST respond with valid JSON only. No markdown, no commentary.';
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
      if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
      logger.warn(`Failed to parse Anthropic structured output as JSON. Raw: ${raw.slice(0, 200)}`);
      throw new Error('Anthropic structured output was not valid JSON.');
    }
  }

  async #callWithRetry(body: any, attempt: number = 0): Promise<string> {
    const maxAttempts = 3;
    try {
      const result = await apiPost(
        this.baseUrl,
        { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
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
        logger.warn(`Anthropic ${this.model}: ${err.message}. Retrying (${attempt + 2}/${maxAttempts}) in ${Math.round(wait)}ms...`);
        await new Promise((r) => setTimeout(r, wait));
        return this.#callWithRetry(body, attempt + 1);
      }

      throw err;
    }
  }
}

export type ProviderType = 'openai' | 'anthropic' | 'groq' | 'local';

export function createProvider(type: ProviderType, apiKey: string, model?: string): AIService {
  if (type !== 'local') {
    const trimmed = Array.isArray(apiKey) ? apiKey : String(apiKey).trim();
    if (!trimmed || (Array.isArray(trimmed) && trimmed.filter(Boolean).length === 0)) {
      throw new Error(`No API key configured for provider "${type}". Set GROQ_API_KEY or OPENAI_API_KEY.`);
    }
  }

  switch (type) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'groq': {
      const resolved = model
        || process.env['AI_MODEL']
        || process.env['GROQ_MODEL']
        || GROQ_MODEL_CANDIDATES[0];
      return new OpenAIProvider(apiKey, resolved, 'https://api.groq.com/openai');
    }
    case 'local': {
      return new LocalProvider();
    }
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
