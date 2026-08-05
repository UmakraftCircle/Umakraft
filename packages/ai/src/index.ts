import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('AI-Service');

export interface GenerateOptions {
  system?: string;
  prompt: string;
  schema?: any;
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
    
    if (options.prompt.toLowerCase().includes('pr') || options.prompt.toLowerCase().includes('pull request') || options.prompt.toLowerCase().includes('github')) {
      return {
        tasks: [
          {
            id: 'task-1',
            name: 'Fetch Open Pull Requests',
            toolSlug: 'pr-monitor-fetch-prs',
            arguments: { repo: 'ai-agent-platform' },
            dependencies: [],
            maxRetries: 3
          },
          {
            id: 'task-2',
            name: 'Generate PR Summary',
            toolSlug: 'pr-monitor-summary',
            arguments: { repo: 'ai-agent-platform' },
            dependencies: ['task-1'],
            maxRetries: 3
          },
          {
            id: 'task-3',
            name: 'Check My Review Requests',
            toolSlug: 'pr-monitor-review-requests',
            arguments: {},
            dependencies: [],
            maxRetries: 3
          },
          {
            id: 'task-4',
            name: 'Send Discord Notification',
            toolSlug: 'discord-send-message',
            arguments: { message: 'PR monitor digest is ready! Check the summary.' },
            dependencies: ['task-2', 'task-3'],
            maxRetries: 3
          },
          {
            id: 'task-5',
            name: 'Persist Results',
            toolSlug: 'database-store-result',
            arguments: {
              planId: 'plan-pr-monitor',
              data: {
                intent: options.prompt,
                metadata: { modelUsed: 'claude-3-5-sonnet', createdAt: new Date().toISOString() },
                tasks: [
                  { id: 'task-1', status: 'completed', result: { count: 3 } },
                  { id: 'task-2', status: 'completed', result: { totalOpen: 3 } },
                  { id: 'task-3', status: 'completed', result: { count: 1 } },
                  { id: 'task-4', status: 'completed', result: { success: true } }
                ]
              }
            },
            dependencies: ['task-4'],
            maxRetries: 3
          }
        ]
      };
    }

    if (options.prompt.toLowerCase().includes('plan') || options.prompt.toLowerCase().includes('stats')) {
      return {
        tasks: [
          {
            id: 'task-1',
            name: 'Fetch Umamusume Fan Stats',
            toolSlug: 'fan-tracker-fetch-stats',
            arguments: { trainerId: 'trainer-99' },
            dependencies: [],
            maxRetries: 3
          },
          {
            id: 'task-2',
            name: 'Analyze Fan Trends',
            toolSlug: 'fan-tracker-analyze-trends',
            arguments: { metrics: ['active_fans', 'total_support'] },
            dependencies: ['task-1'],
            maxRetries: 3
          },
          {
            id: 'task-3',
            name: 'Generate Weekly Digest',
            toolSlug: 'filesystem-write-file',
            arguments: { 
              path: 'umamusume-digest.md',
              content: '# Umamusume Support & Fan Weekly Digest\\nActive fan tier: Tier-A (Up 12%).'
            },
            dependencies: ['task-2'],
            maxRetries: 3
          },
          {
            id: 'task-4',
            name: 'Send Discord Notification',
            toolSlug: 'discord-send-message',
            arguments: { message: 'Weekly Umamusume digest has been compiled and saved!' },
            dependencies: ['task-3'],
            maxRetries: 3
          },
          {
            id: 'task-5',
            name: 'Persist Results in SQLite DB',
            toolSlug: 'database-store-result',
            arguments: { 
              planId: 'plan-dynamic-sqlite',
              data: {
                intent: 'Please update and analyze my Umamusume trainer stats, write a report, and ping Discord.',
                metadata: { modelUsed: 'claude-3-5-sonnet', createdAt: new Date().toISOString() },
                tasks: [
                  { id: 'task-1', name: 'Fetch Umamusume Fan Stats', toolSlug: 'fan-tracker-fetch-stats', status: 'completed', retryCount: 0, maxRetries: 3, result: { activeFans: 1420500, activeTier: 'SS-Class' } },
                  { id: 'task-2', name: 'Analyze Fan Trends', toolSlug: 'fan-tracker-analyze-trends', status: 'completed', retryCount: 0, maxRetries: 3, result: { growthVelocity: '12.4% weekly' } },
                  { id: 'task-3', name: 'Generate Weekly Digest', toolSlug: 'filesystem-write-file', status: 'completed', retryCount: 0, maxRetries: 3, result: { success: true, path: 'umamusume-digest.md', bytesWritten: 73 } },
                  { id: 'task-4', name: 'Send Discord Notification', toolSlug: 'discord-send-message', status: 'completed', retryCount: 0, maxRetries: 3, result: { success: true, platform: 'discord' } }
                ]
              }
            },
            dependencies: ['task-4'],
            maxRetries: 3
          }
        ]
      };
    }

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
