import { LilyChatContext } from './chat-context.js';

export type ResponseMode = 'tool' | 'knowledge' | 'conversation';

export class ResponsePlanner {
  public determineMode(context: LilyChatContext): ResponseMode {
    if (context.toolResult) {
      return 'tool';
    }
    if (context.knowledge && context.language.intent === 'knowledge_query') {
      return 'knowledge';
    }
    return 'conversation';
  }
}
