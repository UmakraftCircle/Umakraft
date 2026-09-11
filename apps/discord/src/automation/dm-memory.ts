import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('DMMemory');

export interface DMMessageRecord {
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class DMMemoryStore {
  private static instance: DMMemoryStore;
  private history: Map<string, DMMessageRecord[]> = new Map();
  private maxHistory = 20;

  public static getInstance(): DMMemoryStore {
    if (!DMMemoryStore.instance) {
      DMMemoryStore.instance = new DMMemoryStore();
    }
    return DMMemoryStore.instance;
  }

  /**
   * Record a new message in conversation memory for a user.
   */
  public addMessage(userId: string, role: 'user' | 'assistant', content: string): void {
    if (!userId || !content) return;
    const userHistory = this.history.get(userId) ?? [];
    userHistory.push({
      userId,
      role,
      content,
      timestamp: Date.now(),
    });

    // Enforce max 20 messages per user
    if (userHistory.length > this.maxHistory) {
      userHistory.splice(0, userHistory.length - this.maxHistory);
    }

    this.history.set(userId, userHistory);
  }

  /**
   * Retrieve conversation history for a user (up to 20 messages).
   */
  public getHistory(userId: string, limit: number = 20): DMMessageRecord[] {
    const userHistory = this.history.get(userId) ?? [];
    return userHistory.slice(-limit);
  }

  /**
   * Clear conversation history for a specific user.
   */
  public clearHistory(userId: string): void {
    this.history.delete(userId);
  }

  /**
   * Remove old messages past the max age (default: 24 hours).
   */
  public cleanMemory(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, records] of this.history.entries()) {
      const validRecords = records.filter((rec) => now - rec.timestamp < maxAgeMs);
      if (validRecords.length === 0) {
        this.history.delete(userId);
        cleanedCount += records.length;
      } else {
        cleanedCount += records.length - validRecords.length;
        this.history.set(userId, validRecords);
      }
    }

    logger.info(`[DM Memory Cleanup] Evicted ${cleanedCount} expired message records.`);
    return cleanedCount;
  }
}

export const dmMemoryStore = DMMemoryStore.getInstance();
