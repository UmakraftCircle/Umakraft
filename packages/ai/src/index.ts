import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('AI-Service');

export interface GenerateOptions {
  system?: string;
  prompt: string;
  schema?: any;
  // Optional declarative tool schemas exposed to the provider as NATIVE tools
  // (enables `tool_choice: auto` tool-calling for Groq/OpenAI models).
  tools?: any[];
  // Optional output-token budget, forwarded to the provider as `max_tokens`.
  // Leaving it unset preserves the provider default; setting it lets callers
  // bound output to leave headroom under shared TPM limits.
  maxTokens?: number;
}

export abstract class AIService {
  abstract generate(options: GenerateOptions): Promise<string>;
  abstract generateStructuredOutput(options: GenerateOptions): Promise<any>;
  abstract getCurrentModel(): string;
}

export class MockAIService extends AIService {
  constructor(private modelName: string = 'mock-claude-3-5-sonnet') {
    super();
    const env = process.env['NODE_ENV'] || 'development';
    if (env === 'production') {
      throw new Error(
        'MockAIService must NOT be used in production. ' +
        'Set GROQ_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY for real AI.'
      );
    }
    logger.warn(
      `MockAIService active for model "${modelName}" — ` +
      'responses are static placeholders. Set a real API key for production use.'
    );
  }

  public override getCurrentModel(): string {
    return this.modelName;
  }

  public override async generate(options: GenerateOptions): Promise<string> {
    logger.info(`Mocking text generation for model: ${this.modelName}`);
    return `Mock response for prompt: "${options.prompt}"`;
  }

  public override async generateStructuredOutput(options: GenerateOptions): Promise<any> {
    logger.info(`Mocking structured output generation for model: ${this.modelName}`);
    return { success: true, message: 'Default mock structured output' };
  }
}

export * from './providers.js';
export * from './embeddings.js';
export * from './prompts.js';
export * from './greeting-service.js';
export * from './daily-message-service.js';
export * from './milestone-message-service.js';
export * from './monthly-achievement-service.js';
export * from './reminder-message-service.js';
export * from './daily-achievement-service.js';
export * from './local-brain.js';
export * from './local-provider.js';
export * from './compare-summary-service.js';
export * from './agent-system.js';
