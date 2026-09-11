import { createLogger } from '@ai-agent-platform/shared';
import { IntentType } from './intent-router.js';

const logger = createLogger('PromptService');

export class PromptService {
  private static instance: PromptService;

  public static getInstance(): PromptService {
    if (!PromptService.instance) {
      PromptService.instance = new PromptService();
    }
    return PromptService.instance;
  }

  public buildPrompt(intent: IntentType, contextData?: Record<string, any>): string {
    const basePersonality = 'You are Lily, the AI Club Assistant for Umakraft in Umamusume: Pretty Derby. You are supportive, knowledgeable, and polite.';

    switch (intent) {
      case IntentType.CHAT:
        return `${basePersonality} Respond naturally and helpfully to the trainer's inquiry.`;
      case IntentType.HANDBOOK:
        return `${basePersonality} Answer the handbook or club rule question using verified club handbook data.`;
      case IntentType.FAN_SYSTEM:
        return `${basePersonality} Provide clear fan gain and pace metrics based on the trainer's official stats.`;
      case IntentType.LEADERBOARD:
        return `${basePersonality} Deliver accurate leaderboard standings and rank positions.`;
      case IntentType.LINK_REQUEST:
        return `${basePersonality} Guide the trainer through linking their Discord account to their trainer ID.`;
      case IntentType.WEB_SEARCH:
        return `${basePersonality} Summarize the latest verified game patch notes or external updates.`;
      default:
        return basePersonality;
    }
  }
}

export const promptService = PromptService.getInstance();
