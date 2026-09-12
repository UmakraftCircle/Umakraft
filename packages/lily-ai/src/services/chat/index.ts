import { LilyChatContext } from './chat-context.js';

export interface IChatService {
  generateResponse(context: LilyChatContext): Promise<string>;
}

export * from './chat-context.js';
export * from './personality.js';
export * from './prompt-builder.js';
export * from './response-planner.js';
export * from './gemini-adapter.js';
export * from './lily-chat-service.js';
