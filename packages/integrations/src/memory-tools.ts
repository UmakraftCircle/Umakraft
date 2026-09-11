import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import { memoryService } from './memory-service.js';
import { sharedUserMemoryStore, extractRawUserId } from './shared-user-memory.js';

const logger = createLogger('MemoryTools');

/**
 * Tool 1: get_conversation_history
 * Retrieves recent conversation messages for the current user.
 */
export const getConversationHistoryTool: ToolDefinition = {
  slug: 'get_conversation_history',
  name: 'Get Conversation History',
  description: 'Retrieves recent conversation messages between the user and assistant from durable memory. Useful when the user asks what was discussed earlier or requests review of previous messages.',
  parameters: {
    userId: {
      type: 'string',
      description: 'Discord user ID (optional, defaults to current user)',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of recent messages to retrieve (default 10, max 30)',
      required: false,
    },
  },
  handler: async (args: Record<string, any>) => {
    const rawUserId = args['userId'] ? String(args['userId']) : undefined;
    const limit = args['limit'] !== undefined ? Math.min(30, Math.max(1, Number(args['limit']))) : 10;

    if (!rawUserId) {
      return {
        success: false,
        error: 'Missing required userId to retrieve conversation history',
      };
    }

    try {
      const history = await memoryService.getHistory(rawUserId, limit);
      return {
        success: true,
        userId: rawUserId,
        count: history.length,
        messages: history.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      };
    } catch (err: any) {
      logger.error(`Failed to retrieve conversation history: ${err?.message ?? err}`);
      return {
        success: false,
        error: `Could not retrieve conversation history: ${err?.message ?? String(err)}`,
      };
    }
  },
};

/**
 * Tool 2: summarize_conversation
 * Summarizes the recent conversation history with a user or channel.
 */
export const summarizeConversationTool: ToolDefinition = {
  slug: 'summarize_conversation',
  name: 'Summarize Conversation',
  description: 'Generates or retrieves a concise summary of previous conversations with the user. Useful when the user asks "summarize our last conversation" or "what have we talked about?".',
  parameters: {
    userId: {
      type: 'string',
      description: 'Discord user ID',
      required: true,
    },
    channelId: {
      type: 'string',
      description: 'Channel ID (optional, defaults to direct message channel)',
      required: false,
    },
  },
  handler: async (args: Record<string, any>) => {
    const rawUserId = String(args['userId'] || '').trim();
    const channelId = args['channelId'] ? String(args['channelId']).trim() : `discord-dm:${extractRawUserId(rawUserId)}`;

    if (!rawUserId) {
      return {
        success: false,
        error: 'Missing required parameter: userId',
      };
    }

    try {
      const memoryContext = await sharedUserMemoryStore.retrieveMemoryContext(rawUserId, channelId);
      const summaryRecord = await sharedUserMemoryStore.updateConversationSummary(rawUserId, channelId);
      return {
        success: true,
        userId: rawUserId,
        summary: summaryRecord?.summary || memoryContext.summary || 'No extensive conversation history found yet.',
      };
    } catch (err: any) {
      logger.error(`Failed to summarize conversation: ${err?.message ?? err}`);
      return {
        success: false,
        error: `Could not summarize conversation: ${err?.message ?? String(err)}`,
      };
    }
  },
};

/**
 * Tool 3: get_user_profile
 * Retrieves persistent user profile, preferences, goals, and long-term memories.
 */
export const getUserProfileTool: ToolDefinition = {
  slug: 'get_user_profile',
  name: 'Get User Profile',
  description: 'Retrieves the long-term user profile, preferred name, preferences, interests, goals, and salient facts stored for the user.',
  parameters: {
    userId: {
      type: 'string',
      description: 'Discord user ID',
      required: true,
    },
  },
  handler: async (args: Record<string, any>) => {
    const rawUserId = String(args['userId'] || '').trim();
    if (!rawUserId) {
      return {
        success: false,
        error: 'Missing required parameter: userId',
      };
    }

    try {
      const memoryContext = await sharedUserMemoryStore.retrieveMemoryContext(rawUserId, `discord-dm:${extractRawUserId(rawUserId)}`);
      return {
        success: true,
        userId: rawUserId,
        profile: {
          preferredName: memoryContext.profile.preferredName ?? null,
          interests: memoryContext.profile.interests ?? [],
          preferences: memoryContext.profile.preferences ?? [],
          projects: memoryContext.profile.projects ?? [],
          goals: memoryContext.profile.goals ?? [],
        },
        memories: memoryContext.memories.map((m) => ({
          category: m.category,
          fact: m.fact,
          importance: m.importance,
          createdAt: m.createdAt,
        })),
      };
    } catch (err: any) {
      logger.error(`Failed to get user profile: ${err?.message ?? err}`);
      return {
        success: false,
        error: `Could not get user profile: ${err?.message ?? String(err)}`,
      };
    }
  },
};

/**
 * Tool 4: save_user_fact
 * Stores a specific user preference, goal, or identity fact in durable long-term memory.
 */
export const saveUserFactTool: ToolDefinition = {
  slug: 'save_user_fact',
  name: 'Save User Fact',
  description: 'Saves a specific fact, preference, interest, goal, or detail about the user to durable long-term memory. Useful when the user says "remember that..." or explicitly shares personal information.',
  parameters: {
    userId: {
      type: 'string',
      description: 'Discord user ID',
      required: true,
    },
    fact: {
      type: 'string',
      description: 'The fact or preference to remember',
      required: true,
    },
    category: {
      type: 'string',
      description: 'Category of memory: identity, preference, project, goal, interest, or fact',
      required: false,
    },
  },
  handler: async (args: Record<string, any>) => {
    const rawUserId = String(args['userId'] || '').trim();
    const fact = String(args['fact'] || '').trim();
    const category = (String(args['category'] || 'fact').toLowerCase()) as any;

    if (!rawUserId || !fact) {
      return {
        success: false,
        error: 'Missing required parameters: userId and fact',
      };
    }

    try {
      const item = await sharedUserMemoryStore.addMemory(rawUserId, {
        userId: rawUserId,
        fact,
        category: ['identity', 'preference', 'project', 'goal', 'interest', 'fact'].includes(category)
          ? category
          : 'fact',
        importance: 0.9,
      });

      return {
        success: true,
        message: 'Fact successfully saved to durable memory.',
        memoryId: item.id,
        savedFact: item.fact,
        category: item.category,
      };
    } catch (err: any) {
      logger.error(`Failed to save user fact: ${err?.message ?? err}`);
      return {
        success: false,
        error: `Could not save user fact: ${err?.message ?? String(err)}`,
      };
    }
  },
};

/**
 * All Phase 7 autonomous memory tools bundled for registration.
 */
export const allMemoryTools: ToolDefinition[] = [
  getConversationHistoryTool,
  summarizeConversationTool,
  getUserProfileTool,
  saveUserFactTool,
];

