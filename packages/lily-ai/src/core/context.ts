import { LilyAIContext } from './types.js';

// Currently scaffolding only for future context management.
export function createLilyAIContext(userId: string): LilyAIContext {
  return {
    userId,
    sessionId: `session-${Date.now()}`,
    timestamp: new Date()
  };
}
