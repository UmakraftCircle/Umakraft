import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('MemoryManagerService');

export enum MemoryType {
  PROFILE = 'PROFILE',
  PREFERENCE = 'PREFERENCE',
  CLUB = 'CLUB',
  SESSION = 'SESSION',
}

export interface MemoryEntry {
  key: string;
  value: any;
  type: MemoryType;
  confidence: number;
  trainerId?: string;
  timestamp: number;
}

export interface SessionMemory {
  currentTopic?: string;
  recentEntities: string[];
  activeDiscussion?: string;
  expiresAt: number;
}

export class MemoryManagerService {
  private static instance: MemoryManagerService;
  private trainerProfiles: Map<string, Map<string, MemoryEntry>> = new Map();
  private sessionMemories: Map<string, SessionMemory> = new Map();
  private clubMemory: Map<string, MemoryEntry> = new Map();

  public static getInstance(): MemoryManagerService {
    if (!MemoryManagerService.instance) {
      MemoryManagerService.instance = new MemoryManagerService();
    }
    return MemoryManagerService.instance;
  }

  /**
  * Memory Classifier: Evaluates whether a message contains stable facts worth remembering.
  */
  public classifyAndExtract(trainerId: string, message: string): MemoryEntry[] {
    const lower = (message || '').toLowerCase();
    const extracted: MemoryEntry[] = [];
    const now = Date.now();

    // 1. Favorite Umamusume / Preference (e.g., "my favorite is Rice Shower" or "I love Oguri Cap")
    const favMatch = message.match(/(?:my favorite (?:is|uma|umamusume)|i love)\s+([a-zA-Z\s]+)/i);
    if (favMatch && favMatch[1]) {
      const uma = favMatch[1].trim().replace(/[.!?]/g, '');
      const entry: MemoryEntry = {
        key: 'favoriteUma',
        value: uma,
        type: MemoryType.PREFERENCE,
        confidence: 0.95,
        trainerId,
        timestamp: now,
      };
      extracted.push(entry);
      this.storeTrainerMemory(trainerId, entry);
    }

    // 2. Trainer ID / Profile (e.g., "my trainer id is 123456789")
    const idMatch = message.match(/(?:trainer\s*id)\s*(?:is|[:=])\s*([0-9]+)/i);
    if (idMatch && idMatch[1]) {
      const entry: MemoryEntry = {
        key: 'trainerId',
        value: idMatch[1].trim(),
        type: MemoryType.PROFILE,
        confidence: 0.99,
        trainerId,
        timestamp: now,
      };
      extracted.push(entry);
      this.storeTrainerMemory(trainerId, entry);
    }

    // 3. Update Session Memory
    let session = this.sessionMemories.get(trainerId);
    if (!session || now > session.expiresAt) {
      session = { recentEntities: [], expiresAt: now + 45 * 60 * 1000 }; // 45 min TTL
    }

    if (lower.includes('oguri')) session.recentEntities.push('Oguri Cap');
    if (lower.includes('rice shower')) session.recentEntities.push('Rice Shower');
    if (lower.includes('smart falcon')) session.recentEntities.push('Smart Falcon');
    session.recentEntities = Array.from(new Set(session.recentEntities)).slice(-10);
    this.sessionMemories.set(trainerId, session);

    return extracted;
  }

  public storeTrainerMemory(trainerId: string, entry: MemoryEntry): void {
    if (!this.trainerProfiles.has(trainerId)) {
      this.trainerProfiles.set(trainerId, new Map());
    }
    const profile = this.trainerProfiles.get(trainerId)!;
    if (profile.size >= 50) {
      // Enforce profile limit of 50 entries
      const oldestKey = profile.keys().next().value;
      if (oldestKey) profile.delete(oldestKey);
    }
    profile.set(entry.key, entry);
    logger.info(`[MemoryManager] Stored Trainer Profile memory for ${trainerId}: ${entry.key} = ${entry.value}`);
  }

  public getTrainerMemory(trainerId: string, key: string): any | null {
    const profile = this.trainerProfiles.get(trainerId);
    if (!profile) return null;
    const entry = profile.get(key);
    return entry ? entry.value : null;
  }

  public getAllTrainerMemories(trainerId: string): Record<string, any> {
    const profile = this.trainerProfiles.get(trainerId);
    if (!profile) return {};
    const result: Record<string, any> = {};
    for (const [k, v] of profile.entries()) {
      result[k] = v.value;
    }
    return result;
  }

  public getSessionMemory(trainerId: string): SessionMemory | null {
    const session = this.sessionMemories.get(trainerId);
    if (!session || Date.now() > session.expiresAt) return null;
    return session;
  }

  public setClubMemory(key: string, value: any): void {
    const entry: MemoryEntry = {
      key,
      value,
      type: MemoryType.CLUB,
      confidence: 0.99,
      timestamp: Date.now(),
    };
    this.clubMemory.set(key, entry);
    logger.info(`[MemoryManager] Stored Club memory: ${key} = ${value}`);
  }

  public getClubMemory(key: string): any | null {
    const entry = this.clubMemory.get(key);
    return entry ? entry.value : null;
  }

  public clear(): void {
    this.trainerProfiles.clear();
    this.sessionMemories.clear();
    this.clubMemory.clear();
  }
}

export const memoryManagerService = MemoryManagerService.getInstance();
