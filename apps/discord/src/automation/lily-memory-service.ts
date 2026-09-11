import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createLogger } from '@ai-agent-platform/shared';
import { trainerMemoryStore } from './trainer-memory.js';
import { dmMemoryStore } from './dm-memory.js';

const logger = createLogger('LilyMemoryService');

export type MemoryImportance = 'critical' | 'important' | 'temporary';

export interface KnowledgeCard {
  type: 'preference' | 'goal' | 'achievement' | 'topic' | 'club_status';
  trainerId: string;
  key: string;
  value: any;
  importance: MemoryImportance;
  timestamp: number;
}

export class LilyMemoryService {
  private static instance: LilyMemoryService;
  private knowledgeCards: Map<string, KnowledgeCard[]> = new Map();
  private repositoryKnowledgeIndex: Map<string, string> = new Map();

  private constructor() {
    this.indexRepositoryHandbook();
  }

  public static getInstance(): LilyMemoryService {
    if (!LilyMemoryService.instance) {
      LilyMemoryService.instance = new LilyMemoryService();
    }
    return LilyMemoryService.instance;
  }

  /**
   * Indexes LILY_HANDBOOK.md into searchrable knowledge snippets (Layer 3).
   */
  private indexRepositoryHandbook(): void {
    try {
      const handbookPath = resolve(process.cwd(), 'LILY_HANDBOOK.md');
      if (existsSync(handbookPath)) {
        const content = readFileSync(handbookPath, 'utf8');
        const sections = content.split(/^## /m);
        for (const section of sections) {
          const lines = section.trim().split('\n');
          const title = lines[0]?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'overview';
          this.repositoryKnowledgeIndex.set(title, section);
        }
        logger.info(`[LilyMemoryService] Indexed ${this.repositoryKnowledgeIndex.size} sections from LILY_HANDBOOK.md.`);
      }
    } catch (err: any) {
      logger.warn(`[LilyMemoryService] Failed to index LILY_HANDBOOK.md: ${err?.message}`);
    }
  }

  /**
   * Stores a structured knowledge card (Layer 2 & 4).
   */
  public storeCard(card: Omit<KnowledgeCard, 'timestamp'>): void {
    const cards = this.knowledgeCards.get(card.trainerId) ?? [];
    const existingIndex = cards.findIndex((c) => c.key === card.key && c.type === card.type);
    const newCard: KnowledgeCard = { ...card, timestamp: Date.now() };

    if (existingIndex >= 0) {
      cards[existingIndex] = newCard;
    } else {
      cards.push(newCard);
    }

    this.knowledgeCards.set(card.trainerId, cards);
    logger.info(`[LilyMemoryService] Stored knowledge card [${card.type}:${card.key}] for Trainer ${card.trainerId} (Importance: ${card.importance})`);

    // Synchronize with TrainerMemoryStore if preference or goal
    if (card.type === 'preference') {
      trainerMemoryStore.setPermanentMemory(card.trainerId, {
        preferences: { [card.key]: card.value },
      });
    } else if (card.type === 'goal') {
      trainerMemoryStore.setWorkingMemory(card.trainerId, {
        activeGoals: [card.value],
      });
    }
  }

  /**
   * Retrieves all knowledge cards for a trainer.
   */
  public getCards(trainerId: string): KnowledgeCard[] {
    return this.knowledgeCards.get(trainerId) ?? [];
  }

  /**
   * Searches repository knowledge index (Layer 3).
   */
  public searchRepositoryKnowledge(query: string): string[] {
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [key, content] of this.repositoryKnowledgeIndex.entries()) {
      if (key.includes(lowerQuery) || content.toLowerCase().includes(lowerQuery)) {
        results.push(content);
      }
    }

    return results.length > 0 ? results : Array.from(this.repositoryKnowledgeIndex.values()).slice(0, 2);
  }

  /**
   * Compiles the complete hierarchical memory context package for Mistral (Layers 1, 2, 3, & 4).
   */
  public compileMemoryContext(trainerId: string, currentQuery: string): {
    shortTermMemory: string;
    longTermMemory: string;
    repositoryMemory: string;
    clubMemory: string;
    formattedInjection: string;
  } {
    // Layer 1: Short-Term (recent DM messages)
    const history = dmMemoryStore.getHistory(trainerId, 20);
    const shortTermMemory = history
      .map((m) => `${m.role === 'user' ? 'Trainer' : 'Lily'}: ${m.content}`)
      .join('\n');

    // Layer 2: Long-Term Trainer Memory & Knowledge Cards
    const perm = trainerMemoryStore.getPermanentMemory(trainerId);
    const cards = this.getCards(trainerId);
    const criticalCards = cards.filter((c) => c.importance === 'critical' || c.importance === 'important');

    const longTermParts: string[] = [];
    if (perm.trainerName) longTermParts.push(`Preferred Name / Nickname: ${perm.trainerName}`);
    if (perm.preferences.favoriteUmamusume) longTermParts.push(`Favorite Uma Musume: ${perm.preferences.favoriteUmamusume}`);
    if (perm.preferences.preferredDistance) longTermParts.push(`Preferred Distance: ${perm.preferences.preferredDistance}`);
    for (const card of criticalCards) {
      if (!longTermParts.some((p) => p.includes(card.key))) {
        longTermParts.push(`${card.key}: ${card.value}`);
      }
    }
    const longTermMemory = longTermParts.join('\n');

    // Layer 3: Repository Knowledge Memory
    const repoSnippets = this.searchRepositoryKnowledge(currentQuery);
    const repositoryMemory = repoSnippets.join('\n\n').substring(0, 2000);

    // Layer 4: Club Memory (Goals & Milestones)
    const work = trainerMemoryStore.getWorkingMemory(trainerId);
    const clubMemory = [
      work.activeGoals.length ? `Active Goals: ${work.activeGoals.join(', ')}` : '',
      work.currentBuild ? `Current Build: ${work.currentBuild}` : '',
      work.recentTopics.length ? `Recent Topics: ${work.recentTopics.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const formattedInjection = [
      `### [Lily Cognitive Memory Engine — Phase 7 Context Package]`,
      longTermMemory ? `• **Long-Term Trainer Profile & Preferences**:\n${longTermMemory}` : '',
      clubMemory ? `• **Club Activity & Goals Memory**:\n${clubMemory}` : '',
      repositoryMemory ? `• **Relevant Repository Knowledge**:\n${repositoryMemory}` : '',
      shortTermMemory ? `• **Recent Conversation History**:\n${shortTermMemory}` : '',
    ].filter(Boolean).join('\n\n');

    return {
      shortTermMemory,
      longTermMemory,
      repositoryMemory,
      clubMemory,
      formattedInjection,
    };
  }

  /**
   * Cleans up expired temporary memories.
   */
  public cleanExpiredMemories(): void {
    dmMemoryStore.cleanMemory(24 * 60 * 60 * 1000);
    logger.info('[LilyMemoryService] Cleaned expired temporary working memories.');
  }
}

export const lilyMemoryService = LilyMemoryService.getInstance();
