import { createLogger } from '@ai-agent-platform/shared';
import {
  conversationMemoryStore,
  type ChatMessage,
  MAX_MESSAGES,
} from './conversation-memory.js';
import {
  sharedUserMemoryStore,
  formatUserId,
  extractRawUserId,
  type UserProfile,
  type UserMemoryItem,
  type MemoryContext,
} from './shared-user-memory.js';

const logger = createLogger('MemoryService');

/**
 * Memory Service Abstraction.
 * Provides unified management of:
 *  1. Persistent Multi-Turn Conversation History (survives bot restarts).
 *  2. Sliding Window Context Limits to prevent token overflow.
 *  3. User Session Isolation keyed by Discord User ID.
 *  4. Long-Term Fact Extraction and Profile Personalization.
 */
export interface MemoryService {
  /** Load multi-turn conversation history for a given user from persistent store. */
  getHistory(userId: string, limit?: number, channelId?: string): Promise<ChatMessage[]>;

  /** Save a user message into persistent store and update conversation state. */
  saveUserMessage(userId: string, content: string, channelId?: string): Promise<void>;

  /** Save an assistant response into persistent store and update conversation state. */
  saveAssistantMessage(userId: string, content: string, channelId?: string): Promise<void>;

  /** Format multi-turn conversation messages into contextual prompt string for LLM injection. */
  formatHistoryForPrompt(messages: ChatMessage[]): string;

  /** Clear conversation history for a given user (or all users if undefined). */
  clearHistory(userId?: string): Promise<void>;

  /** Retrieve long-term memory facts, profile attributes, and system prompt injection. */
  getUserContext(userId: string, channelId?: string): Promise<MemoryContext>;

  /** Update long-term user profile preferences and facts. */
  updateUserProfile(userId: string, patch: Partial<UserProfile>): Promise<UserProfile>;

  /** Extract and save salient memory facts from user utterance. */
  extractAndSaveFacts(userId: string, message: string): Promise<void>;
}

/**
 * Default persistent implementation of MemoryService.
 * Backed by Turso SQLite database infrastructure with zero-latency in-memory cache
 * and automatic fallback when running without database credentials.
 */
export class PersistentMemoryService implements MemoryService {
  private defaultLimit: number;

  constructor(limit: number = MAX_MESSAGES) {
    const envLimit = process.env['DISCORD_MEMORY_LIMIT'] || process.env['MAX_CONTEXT_MESSAGES'];
    this.defaultLimit = envLimit ? Math.max(1, Number(envLimit)) : limit;
  }

  /**
   * Loads conversation history for a given Discord user.
   * Retrieves from the persistent store (survives bot restarts) and respects sliding window limits.
   */
  async getHistory(userId: string, limit?: number, channelId?: string): Promise<ChatMessage[]> {
    const rawId = extractRawUserId(userId);
    const effectiveLimit = limit ?? this.defaultLimit;
    const scopeChannel = channelId ?? `discord-dm:${rawId}`;

    try {
      // 1. Fetch from durable persistent store
      const turns = await conversationMemoryStore.recent(rawId, scopeChannel, effectiveLimit);
      if (turns.length > 0) {
        return turns.map((t) => ({
          role: t.role,
          content: t.content,
          timestamp: t.createdAt,
        }));
      }

      // 2. Fall back to in-memory conversation store if recent returned empty
      const inMemory = conversationMemoryStore.getConversation(rawId);
      return inMemory.slice(-effectiveLimit);
    } catch (err: any) {
      logger.warn(`Failed to fetch history from persistent store for ${rawId}: ${err?.message ?? err}`);
      return conversationMemoryStore.getConversation(rawId).slice(-effectiveLimit);
    }
  }

  /**
   * Saves a user message to persistent storage.
   */
  async saveUserMessage(userId: string, content: string, channelId?: string): Promise<void> {
    const rawId = extractRawUserId(userId);
    const scopeChannel = channelId ?? `discord-dm:${rawId}`;

    try {
      await conversationMemoryStore.append({
        userId: rawId,
        channelId: scopeChannel,
        role: 'user',
        content,
      });
      logger.info(`[MemoryService] Saved user message for ${rawId} (${content.length} chars)`);
    } catch (err: any) {
      logger.warn(`[MemoryService] Failed to persist user message: ${err?.message ?? err}`);
      conversationMemoryStore.addMessage(rawId, 'user', content);
    }
  }

  /**
   * Saves an assistant response to persistent storage.
   */
  async saveAssistantMessage(userId: string, content: string, channelId?: string): Promise<void> {
    const rawId = extractRawUserId(userId);
    const scopeChannel = channelId ?? `discord-dm:${rawId}`;

    try {
      await conversationMemoryStore.append({
        userId: rawId,
        channelId: scopeChannel,
        role: 'assistant',
        content,
      });
      logger.info(`[MemoryService] Saved assistant response for ${rawId} (${content.length} chars)`);

      // Update conversation summary in background
      sharedUserMemoryStore
        .updateConversationSummary(rawId, scopeChannel)
        .catch((summaryErr: any) => {
          logger.warn(`[MemoryService] Summary update skipped: ${summaryErr?.message ?? summaryErr}`);
        });
    } catch (err: any) {
      logger.warn(`[MemoryService] Failed to persist assistant response: ${err?.message ?? err}`);
      conversationMemoryStore.addMessage(rawId, 'assistant', content);
    }
  }

  /**
   * Formats chat messages into a context string suitable for LLM prompt injection.
   */
  formatHistoryForPrompt(messages: ChatMessage[]): string {
    if (!messages || messages.length === 0) return '';
    return messages
      .map((m) => `${m.role === 'user' ? 'Trainer' : 'Assistant'}: ${m.content}`)
      .join('\n');
  }

  /**
   * Clears history for a user across in-memory and persistent stores.
   */
  async clearHistory(userId?: string): Promise<void> {
    const rawId = userId ? extractRawUserId(userId) : undefined;
    conversationMemoryStore.clear(rawId);
    logger.info(`[MemoryService] Cleared conversation history for ${rawId ?? 'all users'}`);
  }

  /**
   * Retrieves user profile, long-term memory facts, and persona injection.
   */
  async getUserContext(userId: string, channelId?: string): Promise<MemoryContext> {
    const rawId = extractRawUserId(userId);
    const scopeChannel = channelId ?? `discord-dm:${rawId}`;
    return sharedUserMemoryStore.retrieveMemoryContext(rawId, scopeChannel);
  }

  /**
   * Updates user profile fields.
   */
  async updateUserProfile(userId: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    const rawId = extractRawUserId(userId);
    return sharedUserMemoryStore.updateProfile(rawId, patch);
  }

  /**
   * Extracts and stores salient long-term facts from a user message.
   */
  async extractAndSaveFacts(userId: string, message: string): Promise<void> {
    const rawId = extractRawUserId(userId);
    await sharedUserMemoryStore.extractAndSaveMemory(rawId, message);
  }
}

/** Shared singleton MemoryService instance. */
export const memoryService: MemoryService = new PersistentMemoryService();
