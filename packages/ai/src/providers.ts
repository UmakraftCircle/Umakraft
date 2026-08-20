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

/** Rough token estimate (chars/4) used only for logging/budget decisions. */
function estimateTokens(s: string | undefined): number {
  return s ? Math.ceil(s.length / 4) : 0;
}

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
  return err.statusCode === 400 && /tool_use_failed|Tool choice is none|json_validate_failed/.test(err.message);
}

const GROQ_MODEL_CANDIDATES: string[] = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
];

/**
 * Ordered fallback list for Groq model auto-selection. The default (first entry)
 * is the primary; on persistent 429 rate limits we walk this chain to a
 * less-contended model. Note: the `qwen/qwen3.6-*` models are intentionally NOT
 * in this list — they are heavily rate-limited on the free tier. Prefer these
 * OpenAI-compatible / Llama endpoints that Groq serves at higher RPM/TPM.
 */
const GROQ_MODEL_FALLBACKS: string[] = [
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
];

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff + jitter wait time for a 429 rate-limit, keyed by attempt
 * index. Grows 1s → 2s → 4s … capped at ~30s, plus jitter so concurrent calls
 * don't stampede.
 */
function backoffMs(attempt: number): number {
  const base = 1000 * Math.pow(2, Math.min(attempt, 5));
  const jitter = Math.random() * base * 0.3;
  return Math.round(base + jitter);
}

export interface DeclarativeTool {
  slug: string;
  name?: string;
  description?: string;
  parameters?: Record<string, { type?: string; description?: string; required?: boolean; enum?: string[] }>;
}

const JSON_TYPE_MAP: Record<string, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  object: 'object',
  array: 'array',
};

function toNativeTool(tool: DeclarativeTool): any {
  const props: Record<string, any> = {};
  const required: string[] = [];
  for (const [key, p] of Object.entries(tool.parameters ?? {})) {
    const type = JSON_TYPE_MAP[p.type ?? 'string'] ?? 'string';
    const prop: any = { type };
    if (p.description) prop.description = p.description;
    if (p.enum && p.enum.length) prop.enum = p.enum;
    props[key] = prop;
    if (p.required) required.push(key);
  }
  return {
    type: 'function',
    function: {
      name: tool.slug,
      description: tool.description ?? tool.name ?? tool.slug,
      parameters: {
        type: 'object',
        properties: props,
        ...(required.length ? { required } : {}),
      },
    },
  };
}

export class OpenAIProvider implements AIService {
  private model: string;
  private keys: string[];
  private baseUrl: string;
  private fallbackModels: string[];

  constructor(
    apiKey: string | string[],
    model: string = 'gpt-4o-mini',
    baseUrl: string = 'https://api.openai.com',
    fallbackModels?: string[],
  ) {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fallbackModels = fallbackModels ?? [];

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
    return this.#callWithRetry(messages, { temperature: 0.7, ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}) });
  }

  public async generateStructuredOutput(options: GenerateOptions): Promise<any> {
    const messages: any[] = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: options.prompt });

    const estInput = estimateTokens(options.system) + estimateTokens(options.prompt);
    if (options.maxTokens) {
      logger.info(
        `[token-budget] provider estimated input=${estInput} tokens; max_tokens=${options.maxTokens}`,
      );
    }

    const tools: DeclarativeTool[] | undefined = options.tools;

    if (tools && tools.length > 0) {
      const nativeTools = tools.map(toNativeTool);
      const toolNames = nativeTools.map((t) => t.function.name);
      // Defensive invariant: if tools are present, tool_choice MUST be "auto"
      // (never "none"), otherwise Groq will 400 with tool_use_failed.
      const extra: Record<string, any> = { temperature: 0.3, tools: nativeTools, tool_choice: 'auto' };
      if (options.maxTokens) extra.max_tokens = options.maxTokens;

      // Log the FINAL outbound config (no secrets / headers / user data).
      logger.info(
        `[structured-native] model=${this.model} tool_choice=${extra.tool_choice} tools=[${toolNames.join(', ')}] max_tokens=${options.maxTokens ?? 'unset'}`,
      );

      const result = await this.#callWithRetryNativeWithFallback(messages, extra);

      const message = result.choices?.[0]?.message;
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const call = message.tool_calls[0];
        const action = call.function?.name;
        let parameters: Record<string, any> = {};
        try {
          parameters = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          parameters = {};
        }
        logger.info(`[structured-native] model chose tool: ${action}`);
        return { action, parameters };
      }

      const content = message?.content ?? '';
      return { answer: content };
    }

    // No tools: JSON path. Log outbound config for observability.
    logger.info(`[structured-json] model=${this.model} tool_choice=none tools=[] max_tokens=${options.maxTokens ?? 'unset'}`);

    const raw = await this.#callWithRetry(messages, { temperature: 0.3, ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}) }, { allowRetryOn400: false });
    try {
      const parsed = JSON.parse(raw);
      if (hasNativeToolCall(parsed)) throw new Error('native tool-call');
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
    return this.#callWithRetryNativeWithFallback(messages, extra, opts);
  }

  /**
   * Attempts a request across (a) all keys with backoff on 429, and (b) the
   * fallback model chain on persistent 429s. Returns the parsed result object
   * (or raw string content when no native tool-call context is used).
   */
  async #callWithRetryNativeWithFallback(
    messages: any[],
    extra: Record<string, any>,
    opts: { allowRetryOn400?: boolean } = {},
  ): Promise<any> {
    const models = [this.model, ...this.fallbackModels.filter((m) => m !== this.model)];
    let lastError: any;

    for (let mi = 0; mi < models.length; mi++) {
      const model = models[mi];
      if (mi > 0) {
        logger.warn(`[model-fallback] 429 persisted; switching model from ${models[mi - 1]} to ${model}`);
      }
      try {
        return await this.#callWithRetryNative(messages, { ...extra, model });
      } catch (err: any) {
        lastError = err;
        const isRateLimit = err instanceof HttpError && err.statusCode === 429;
        if (!isRateLimit) throw err;
        // else: fall through to the next model.
      }
    }
    throw lastError;
  }

  async #callWithRetryNative(
    messages: any[],
    extra: Record<string, any>,
  ): Promise<any> {
    let lastError: Error = new Error('No keys available for provider call');
    const triedKeys = new Set<string>();
    const model = (extra.model as string) ?? this.model;

    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const pool = triedKeys.size > 0 ? this.keys.filter((k) => !triedKeys.has(k)) : this.keys;
      const key = pool[Math.floor(Math.random() * pool.length)];
      triedKeys.add(key);
      const keySuffix = key.slice(-6);

      try {
        return await apiPost(
          `${this.baseUrl}/v1/chat/completions`,
          { Authorization: `Bearer ${key}` },
          { model, messages, ...extra },
        );
      } catch (err: any) {
        lastError = err;
        if (isToolUseFailed(err)) {
          logger.error(`Provider config/validation error (no retry): ${err.message}`);
          throw err;
        }
        const isRateLimit = err instanceof HttpError && err.statusCode === 429;
        if (isRateLimit && triedKeys.size < this.keys.length) {
          const wait = backoffMs(attempt);
          logger.warn(`Key ...${keySuffix} rate-limited (429), backing off ${Math.round(wait / 1000)}s before rotating (attempt ${attempt + 2}/${this.keys.length})`);
          await sleep(wait);
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

const NATIVE_TOOL_KEYS = ['name', 'arguments', 'tool_calls', 'function'];

function hasNativeToolCall(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return NATIVE_TOOL_KEYS.some((k) => k in (obj as Record<string, unknown>));
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
        await sleep(wait);
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
        || GROQ_MODEL_FALLBACKS[0];
      return new OpenAIProvider(apiKey, resolved, 'https://api.groq.com/openai', GROQ_MODEL_FALLBACKS);
    }
    case 'local': {
      return new LocalProvider();
    }
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
