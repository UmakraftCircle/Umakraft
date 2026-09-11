import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('TrainerMemory');

export interface PermanentTrainerMemory {
  userId: string;
  trainerId?: string;
  trainerName?: string;
  clubStatus?: 'Member' | 'Officer' | 'Leader' | 'Non-Member';
  joinDate?: string;
  linkedStatus: boolean;
  interactionCount: number;
  preferences: {
    preferredCharacter?: string;
    preferredDistance?: 'Short' | 'Mile' | 'Medium' | 'Long' | 'Dirt';
    preferredStrategy?: 'Runner' | 'Leader' | 'Betweener' | 'Chaser';
    favoriteUmamusume?: string;
    preferredNickname?: string;
    favoriteSupportCards?: string[];
    language?: string;
    [key: string]: any;
  };
}

export interface WorkingTrainerMemory {
  userId: string;
  currentBuild?: string;
  currentTrainingProject?: string;
  activeGoals: string[];
  recentTopics: string[];
  lastUpdated: number;
}

export class TrainerMemoryStore {
  private static instance: TrainerMemoryStore;
  private permanentMemories: Map<string, PermanentTrainerMemory> = new Map();
  private workingMemories: Map<string, WorkingTrainerMemory> = new Map();

  public static getInstance(): TrainerMemoryStore {
    if (!TrainerMemoryStore.instance) {
      TrainerMemoryStore.instance = new TrainerMemoryStore();
    }
    return TrainerMemoryStore.instance;
  }

  public getPermanentMemory(userId: string): PermanentTrainerMemory {
    if (!this.permanentMemories.has(userId)) {
      this.permanentMemories.set(userId, {
        userId,
        linkedStatus: false,
        interactionCount: 0,
        preferences: {},
      });
    }
    const mem = this.permanentMemories.get(userId)!;
    mem.interactionCount = (mem.interactionCount || 0) + 1;
    return mem;
  }

  public getFamiliarityLevel(userId: string): 1 | 2 | 3 {
    const perm = this.getPermanentMemory(userId);
    const count = perm.interactionCount || 1;
    const hasPrefs = Object.keys(perm.preferences).length > 0;
    if (count > 15 || (count > 5 && hasPrefs)) return 3; // Regular Trainer
    if (count > 3 || hasPrefs) return 2; // Familiar Trainer
    return 1; // New Trainer
  }

  public getWorkingMemory(userId: string): WorkingTrainerMemory {
    if (!this.workingMemories.has(userId)) {
      this.workingMemories.set(userId, {
        userId,
        activeGoals: [],
        recentTopics: [],
        lastUpdated: Date.now(),
      });
    }
    return this.workingMemories.get(userId)!;
  }

  public setPermanentMemory(userId: string, data: Partial<PermanentTrainerMemory>): void {
    const current = this.getPermanentMemory(userId);
    const updated = {
      ...current,
      ...data,
      preferences: {
        ...current.preferences,
        ...(data.preferences || {}),
      },
    };
    this.permanentMemories.set(userId, updated);
    logger.info(`[TrainerMemory] Updated Permanent Memory for User: ${userId}`);
  }

  public setWorkingMemory(userId: string, data: Partial<WorkingTrainerMemory>): void {
    const current = this.getWorkingMemory(userId);
    const updated = {
      ...current,
      ...data,
      activeGoals: Array.from(new Set([...current.activeGoals, ...(data.activeGoals || [])])),
      recentTopics: Array.from(new Set([...current.recentTopics, ...(data.recentTopics || [])])).slice(-10),
      lastUpdated: Date.now(),
    };
    this.workingMemories.set(userId, updated);
    logger.info(`[TrainerMemory] Updated Working Memory for User: ${userId}`);
  }

  public addPreference(userId: string, key: string, value: any): void {
    const perm = this.getPermanentMemory(userId);
    perm.preferences[key] = value;
    this.permanentMemories.set(userId, perm);
    logger.info(`[TrainerMemory] Added Preference [${key}=${value}] for User: ${userId}`);
  }

  public addGoal(userId: string, goal: string): void {
    const work = this.getWorkingMemory(userId);
    if (!work.activeGoals.includes(goal)) {
      work.activeGoals.push(goal);
      work.lastUpdated = Date.now();
      this.workingMemories.set(userId, work);
      logger.info(`[TrainerMemory] Added Goal ["${goal}"] for User: ${userId}`);
    }
  }

  public addRecentTopic(userId: string, topic: string): void {
    const work = this.getWorkingMemory(userId);
    if (!work.recentTopics.includes(topic)) {
      work.recentTopics.push(topic);
      if (work.recentTopics.length > 10) work.recentTopics.shift();
      work.lastUpdated = Date.now();
      this.workingMemories.set(userId, work);
    }
  }

  /**
   * Generates formatted Trainer Context for system prompt injection.
   */
  public getTrainerContextPrompt(userId: string): string {
    const perm = this.getPermanentMemory(userId);
    const work = this.getWorkingMemory(userId);
    const familiarity = this.getFamiliarityLevel(userId);

    const hasData = perm.trainerName || perm.linkedStatus || work.activeGoals.length > 0 || Object.keys(perm.preferences).length > 0;
    if (!hasData) {
      return `[Trainer Context]\n• Familiarity Level: Level ${familiarity} (New Trainer)\n• Status: Unlinked Trainer Context`;
    }

    const lines: string[] = [
      `[Trainer Memory & Context]`,
      `• Familiarity Level: Level ${familiarity} (${familiarity === 1 ? 'New Trainer' : familiarity === 2 ? 'Familiar Trainer' : 'Regular Trainer'})`,
    ];
    if (perm.trainerName) lines.push(`• Trainer Name: ${perm.trainerName}`);
    if (perm.trainerId) lines.push(`• Trainer ID: ${perm.trainerId}`);
    lines.push(`• Linked Status: ${perm.linkedStatus ? 'Linked' : 'Unlinked'}`);
    if (perm.clubStatus) lines.push(`• Club Rank: ${perm.clubStatus}`);

    const prefs = Object.entries(perm.preferences)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(', ');
    if (prefs) lines.push(`• Trainer Preferences (Favorite Uma, Cards, Style): ${prefs}`);

    if (work.activeGoals.length > 0) {
      lines.push(`• Active Goals & Milestones: ${work.activeGoals.join(' | ')}`);
    }

    if (work.currentBuild) {
      lines.push(`• Current Build Project: ${work.currentBuild}`);
    }

    if (work.recentTopics.length > 0) {
      lines.push(`• Recent Discussion Topics: ${work.recentTopics.join(', ')}`);
    }

    logger.info(`[telemetry] Trainer Context Injected | User: ${userId} | Familiarity: Level ${familiarity} | Goals: ${work.activeGoals.length} | Prefs: ${Object.keys(perm.preferences).length}`);

    return lines.join('\n');
  }
}

export const trainerMemoryStore = TrainerMemoryStore.getInstance();
