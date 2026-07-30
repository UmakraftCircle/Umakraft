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
