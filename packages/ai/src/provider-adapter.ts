import { createLogger } from '@ai-agent-platform/shared';
import {
  AIService,
  MockAIService,
  OpenAIProvider,
  AnthropicProvider,
  createProvider,
  GenerateOptions,
} from './index.js';
import { LocalProvider } from './local-provider.js';

const logger = createLogger('ProviderAdapter');

/**
 * Strategy object returned by the ModelRouter and followed by the Executor.
 */
export interface ModelStrategy {
  provider: 'openai' | 'anthropic' | 'ollama' | 'groq' | 'local' | string;
  model: string;
  temperature: number;
  maxTokens?: number;
  reason?: string;
  estimatedCost?: number;
  metadata?: Record<string, any>;
}

/**
 * Standard request forwarded to a provider adapter.
 */
export interface AdapterRequest {
  strategy: ModelStrategy;
  prompt: string;
  system?: string;
  schema?: any;
  tools?: any[];
  streaming?: boolean;
  onToken?: (token: string) => void;
  maxRetries?: number;
}

/**
 * Unified, normalized response returned by all provider adapters.
 * Executor interacts solely with this normalized representation.
 */
export interface NormalizedResponse<T = any> {
  content: string;
  structured?: T;
  raw?: any;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimatedCost?: number;
  };
  model: string;
  provider: string;
  finishReason?: string;
}

/**
 * Contract for provider-specific adapters.
 */
export interface ProviderAdapter {
  execute(request: AdapterRequest): Promise<NormalizedResponse>;
}

/**
 * Rough token estimator: ~4 chars per token.
 */
function estimateTokens(text: string | undefined): number {
  return text ? Math.ceil(text.length / 4) : 0;
}

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Adapter for OpenAI / Groq / OpenAI-compatible APIs.
 */
export class OpenAIProviderAdapter implements ProviderAdapter {
  constructor(
    private apiKey?: string,
    private baseUrl?: string
  ) {}

  public async execute(request: AdapterRequest): Promise<NormalizedResponse> {
    const { strategy, prompt, system, schema, tools, streaming, onToken } = request;
    const key =
      this.apiKey ||
      process.env['OPENAI_API_KEY'] ||
      (strategy.provider === 'groq' ? (process.env['GROQ_API_KEYS'] || process.env['GROQ_API_KEY']) : undefined);

    // Fall back to Mock in test/dev environments if no API key is set
    if (!key && process.env['NODE_ENV'] !== 'production') {
      logger.warn(`OpenAIProviderAdapter: No API key found for ${strategy.provider}. Using mock fallback.`);
      return new MockProviderAdapter().execute(request);
    }

    const providerInstance =
      strategy.provider === 'groq'
        ? createProvider('groq', key || 'dummy-key', strategy.model)
        : new OpenAIProvider(key || 'dummy-key', strategy.model, this.baseUrl);

    const generateOptions: GenerateOptions = {
      prompt,
      system,
      schema,
      tools,
      maxTokens: strategy.maxTokens,
    };

    let content = '';
    let structured: any;

    if (tools && tools.length > 0) {
      structured = await providerInstance.generateStructuredOutput(generateOptions);
      content = typeof structured === 'string' ? structured : JSON.stringify(structured);
    } else if (schema) {
      structured = await providerInstance.generateStructuredOutput(generateOptions);
      content = typeof structured === 'string' ? structured : JSON.stringify(structured);
    } else {
      content = await providerInstance.generate(generateOptions);
    }

    if (streaming && onToken) {
      const chunks = content.split(/(\s+)/);
      for (const chunk of chunks) {
        onToken(chunk);
      }
    }

    const promptTokens = estimateTokens(prompt) + estimateTokens(system);
    const completionTokens = estimateTokens(content);

    return {
      content,
      structured,
      model: strategy.model,
      provider: strategy.provider,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCost: strategy.estimatedCost,
      },
      finishReason: 'stop',
    };
  }
}

/**
 * Adapter for Anthropic Claude API.
 */
export class AnthropicProviderAdapter implements ProviderAdapter {
  constructor(private apiKey?: string) {}

  public async execute(request: AdapterRequest): Promise<NormalizedResponse> {
    const { strategy, prompt, system, schema, streaming, onToken } = request;
    const key = this.apiKey || process.env['ANTHROPIC_API_KEY'];

    if (!key && process.env['NODE_ENV'] !== 'production') {
      logger.warn('AnthropicProviderAdapter: No API key found. Using mock fallback.');
      return new MockProviderAdapter().execute(request);
    }

    const providerInstance = new AnthropicProvider(key || 'dummy-key', strategy.model);
    const generateOptions: GenerateOptions = {
      prompt,
      system,
      schema,
      maxTokens: strategy.maxTokens,
    };

    let content = '';
    let structured: any;

    if (schema) {
      structured = await providerInstance.generateStructuredOutput(generateOptions);
      content = typeof structured === 'string' ? structured : JSON.stringify(structured);
    } else {
      content = await providerInstance.generate(generateOptions);
    }

    if (streaming && onToken) {
      const chunks = content.split(/(\s+)/);
      for (const chunk of chunks) {
        onToken(chunk);
      }
    }

    const promptTokens = estimateTokens(prompt) + estimateTokens(system);
    const completionTokens = estimateTokens(content);

    return {
      content,
      structured,
      model: strategy.model,
      provider: strategy.provider,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCost: strategy.estimatedCost,
      },
      finishReason: 'stop',
    };
  }
}

/**
 * Adapter for local inference (Ollama / LocalProvider).
 */
export class LocalProviderAdapter implements ProviderAdapter {
  private localService = new LocalProvider();

  public async execute(request: AdapterRequest): Promise<NormalizedResponse> {
    const { strategy, prompt, system, schema, streaming, onToken } = request;

    let content = '';
    let structured: any;

    try {
      if (schema) {
        structured = await this.localService.generateStructuredOutput({ prompt, system, schema });
        content = typeof structured === 'string' ? structured : JSON.stringify(structured);
      } else {
        content = await this.localService.generate({ prompt, system });
      }
    } catch (err: any) {
      logger.warn(`LocalProviderAdapter failed (${err.message}). Falling back to mock response.`);
      return new MockProviderAdapter().execute(request);
    }

    if (streaming && onToken) {
      const chunks = content.split(/(\s+)/);
      for (const chunk of chunks) {
        onToken(chunk);
      }
    }

    const promptTokens = estimateTokens(prompt) + estimateTokens(system);
    const completionTokens = estimateTokens(content);

    return {
      content,
      structured,
      model: strategy.model,
      provider: 'local',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCost: 0,
      },
      finishReason: 'stop',
    };
  }
}

/**
 * Mock adapter used for offline testing and development environments.
 */
export class MockProviderAdapter implements ProviderAdapter {
  public async execute(request: AdapterRequest): Promise<NormalizedResponse> {
    const { strategy, prompt, streaming, onToken, schema } = request;
    const content = `Mock AI response from ${strategy.provider} model [${strategy.model}] for prompt: "${prompt.slice(0, 80)}..."`;

    if (streaming && onToken) {
      const words = content.split(' ');
      for (const word of words) {
        onToken(word + ' ');
      }
    }

    let structured: any = undefined;
    if (schema) {
      structured = { success: true, result: 'mock-structured-output', model: strategy.model };
    }

    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(content);

    return {
      content,
      structured,
      model: strategy.model,
      provider: strategy.provider,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCost: strategy.estimatedCost ?? 0.0001,
      },
      finishReason: 'stop',
    };
  }
}

/**
 * Central AI Provider Adapter orchestrator.
 * Routes execution requests to the isolated provider adapter based on ModelStrategy.
 */
export class AIProviderAdapter {
  private adapters: Map<string, ProviderAdapter> = new Map();
  private defaultMock = new MockProviderAdapter();

  constructor(customAdapters?: Record<string, ProviderAdapter>) {
    this.adapters.set('openai', new OpenAIProviderAdapter());
    this.adapters.set('groq', new OpenAIProviderAdapter());
    this.adapters.set('anthropic', new AnthropicProviderAdapter());
    this.adapters.set('local', new LocalProviderAdapter());
    this.adapters.set('ollama', new LocalProviderAdapter());
    this.adapters.set('mock', this.defaultMock);

    if (customAdapters) {
      for (const [provider, adapter] of Object.entries(customAdapters)) {
        this.adapters.set(provider.toLowerCase(), adapter);
      }
    }
  }

  /**
   * Registers or overrides an adapter for a specific provider.
   */
  public registerAdapter(provider: string, adapter: ProviderAdapter): void {
    this.adapters.set(provider.toLowerCase(), adapter);
  }

  /**
   * Executes a request using the isolated provider adapter indicated by the strategy.
   * Applies retry logic with linear/exponential backoff.
   */
  public async execute(request: AdapterRequest): Promise<NormalizedResponse> {
    const providerKey = (request.strategy.provider || 'mock').toLowerCase();
    const adapter = this.adapters.get(providerKey) ?? this.defaultMock;

    const maxRetries = request.maxRetries ?? 2;
    let attempt = 0;
    let lastError: any;

    while (attempt <= maxRetries) {
      try {
        const response = await adapter.execute(request);
        return response;
      } catch (err: any) {
        lastError = err;
        attempt++;
        if (attempt <= maxRetries) {
          const waitTime = 200 * Math.pow(2, attempt - 1);
          logger.warn(`AIProviderAdapter: Call failed (${err.message}). Retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})...`);
          await sleep(waitTime);
        }
      }
    }

    logger.error(`AIProviderAdapter: All ${maxRetries + 1} attempts failed for provider "${providerKey}".`);
    throw lastError;
  }
}
