import { createLogger } from '@ai-agent-platform/shared';
import { IntentType } from './intent-router.js';

const logger = createLogger('ContextBuilderService');

export interface ContextBudget {
  personality: number; // max tokens
  memory: number;
  history: number;
  handbook: number;
  toolResults: number;
}

const DEFAULT_BUDGET: ContextBudget = {
  personality: 500,
  memory: 500,
  history: 1500,
  handbook: 2000,
  toolResults: 1000,
};

export interface BuiltContext {
  intent: IntentType;
  systemPrompt: string;
  relevantHistory?: string[];
  trainerProfile?: Record<string, any>;
  handbookEntries?: string[];
  fanData?: Record<string, any>;
  leaderboardSnapshot?: Record<string, any>;
  tokenEstimate: number;
}

export class ContextBuilderService {
  private static instance: ContextBuilderService;

  public static getInstance(): ContextBuilderService {
    if (!ContextBuilderService.instance) {
      ContextBuilderService.instance = new ContextBuilderService();
    }
    return ContextBuilderService.instance;
  }

  /**
  * Assembles strict intent-specific context, preventing irrelevant data leakage.
  */
  public buildContext(options: {
    intent: IntentType;
    userMessage: string;
    trainerId: string;
    recentMessages?: string[];
    trainerProfile?: Record<string, any>;
    handbookSnippets?: string[];
    fanStats?: Record<string, any>;
    leaderboardData?: Record<string, any>;
  }): BuiltContext {
    const { intent, recentMessages = [], trainerProfile = {}, handbookSnippets = [], fanStats = {}, leaderboardData = {} } = options;

    const basePersonality = 'You are Lily, the AI Club Assistant for Umakraft in Umamusume: Pretty Derby. You are supportive, knowledgeable, and polite.';

    switch (intent) {
      case IntentType.CHAT: {
        // CHAT Context: Personality + last 10 messages + trainer profile. NO handbook, fan, leaderboard.
        const cappedHistory = recentMessages.slice(-10);
        return {
          intent,
          systemPrompt: basePersonality,
          relevantHistory: cappedHistory,
          trainerProfile: {
            favoriteUmamusume: trainerProfile.favoriteUmamusume ?? 'Unknown',
            trainerName: trainerProfile.trainerName ?? 'Trainer',
          },
          tokenEstimate: 1200,
        };
      }

      case IntentType.HANDBOOK: {
        // HANDBOOK Context: Personality + relevant handbook entries + user question. NO fan gain or DM history.
        return {
          intent,
          systemPrompt: `${basePersonality} You provide precise club rules and handbook guidance.`,
          handbookEntries: handbookSnippets.slice(0, 3),
          tokenEstimate: 1500,
        };
      }

      case IntentType.FAN_SYSTEM: {
        // FAN_SYSTEM Context: Trainer fan data, current month, deficit/surplus. NO handbook or chat history.
        return {
          intent,
          systemPrompt: `${basePersonality} You specialize in tracking fan growth, monthly goals, and pace metrics.`,
          fanData: {
            currentFans: fanStats.currentFans ?? 0,
            targetFans: fanStats.targetFans ?? 150_000_000,
            dailyGain: fanStats.dailyGain ?? 0,
            deficit: fanStats.deficit ?? 0,
          },
          tokenEstimate: 800,
        };
      }

      case IntentType.LEADERBOARD: {
        // LEADERBOARD Context: Leaderboard snapshot, trainer rank, nearby ranks. Nothing else.
        return {
          intent,
          systemPrompt: `${basePersonality} You provide accurate rankings and leaderboard standings.`,
          leaderboardSnapshot: {
            rank: leaderboardData.rank ?? 1,
            topTrainers: leaderboardData.topTrainers ?? [],
          },
          tokenEstimate: 900,
        };
      }

      case IntentType.LINK_REQUEST: {
        return {
          intent,
          systemPrompt: `${basePersonality} You assist trainers with account linking and trainer ID registration.`,
          tokenEstimate: 600,
        };
      }

      case IntentType.WEB_SEARCH: {
        return {
          intent,
          systemPrompt: `${basePersonality} You deliver verified patch notes and external game updates.`,
          tokenEstimate: 1000,
        };
      }

      default: {
        // Fallback / UNKNOWN
        return {
          intent,
          systemPrompt: basePersonality,
          relevantHistory: recentMessages.slice(-5),
          tokenEstimate: 800,
        };
      }
    }
  }

  /**
  * Context Validator: Ensures no irrelevant data leaked into intent context.
  */
  public validateContext(context: BuiltContext): { isValid: boolean; violation?: string } {
    if (context.intent === IntentType.CHAT) {
      if (context.handbookEntries && context.handbookEntries.length > 0) {
        return { isValid: false, violation: 'Handbook entries leaked into CHAT context.' };
      }
      if (context.fanData && Object.keys(context.fanData).length > 0) {
        return { isValid: false, violation: 'Fan data leaked into CHAT context.' };
      }
      if (context.leaderboardSnapshot && Object.keys(context.leaderboardSnapshot).length > 0) {
        return { isValid: false, violation: 'Leaderboard snapshot leaked into CHAT context.' };
      }
    }

    if (context.intent === IntentType.HANDBOOK) {
      if (context.leaderboardSnapshot && Object.keys(context.leaderboardSnapshot).length > 0) {
        return { isValid: false, violation: 'Leaderboard snapshot leaked into HANDBOOK context.' };
      }
    }

    return { isValid: true };
  }
}

export const contextBuilderService = ContextBuilderService.getInstance();
