import { createLogger } from '@ai-agent-platform/shared';
import {
  MemoryRecord,
  RankedMemoryRecord,
  MemoryQuery,
  MemoryType,
  MemoryRankingFactors,
} from './types.js';
import { SessionMemory } from './session-memory.js';
import { SemanticMemory } from './semantic-memory.js';
import { ProfileMemory } from './profile-memory.js';
import { WorkingMemory } from './working-memory.js';

const logger = createLogger('MemoryEngine');

export interface MemoryEngineOptions {
  session?: SessionMemory;
  semantic?: SemanticMemory;
  profile?: ProfileMemory;
  defaultLimit?: number;
}

/**
 * MemoryEngine: Pure retrieval service coordinating independent memory sources.
 * The Executor never queries memory directly; it only consumes memory returned
 * by the Context Loader.
 */
export class MemoryEngine {
  private session: SessionMemory;
  private semantic: SemanticMemory;
  private profile: ProfileMemory;
  private workingMemories: Map<string, WorkingMemory> = new Map();
  private defaultLimit: number;

  constructor(options: MemoryEngineOptions = {}) {
    this.session = options.session ?? new SessionMemory();
    this.semantic = options.semantic ?? new SemanticMemory();
    this.profile = options.profile ?? new ProfileMemory();
    this.defaultLimit = options.defaultLimit ?? 5;
  }

  public getSession(): SessionMemory {
    return this.session;
  }

  public getSemantic(): SemanticMemory {
    return this.semantic;
  }

  public getProfile(): ProfileMemory {
    return this.profile;
  }

  /**
   * Creates isolated working memory for a specific task.
   */
  public createWorkingMemory(taskId: string, initialData?: Record<string, any>): WorkingMemory {
    // If an existing working memory exists for this task, destroy it first
    if (this.workingMemories.has(taskId)) {
      this.workingMemories.get(taskId)?.destroy();
    }
    const working = new WorkingMemory(taskId, initialData);
    this.workingMemories.set(taskId, working);
    return working;
  }

  public getWorkingMemory(taskId: string): WorkingMemory | undefined {
    return this.workingMemories.get(taskId);
  }

  public destroyWorkingMemory(taskId: string): void {
    const wm = this.workingMemories.get(taskId);
    if (wm) {
      wm.destroy();
      this.workingMemories.delete(taskId);
    }
  }

  /**
   * Executes the retrieval pipeline.
   * Flow: Task -> Memory Query -> Memory Engine -> Relevant Memories -> Execution Context
   *
   * Enforces rules:
   * 1. Never injects all memories.
   * 2. Retrieves only task-relevant memories.
   * 3. Ranks candidates by relevance, recency, priority, and exact match before returning.
   */
  public async query(query: MemoryQuery): Promise<RankedMemoryRecord[]> {
    const requestedTypes = new Set<MemoryType>(
      query.types ?? ['session', 'semantic', 'profile', 'working']
    );

    // 1. Gather raw candidates from independent sources
    const candidatePromises: Promise<MemoryRecord[]>[] = [];

    if (requestedTypes.has('session')) {
      candidatePromises.push(this.session.query(query));
    }
    if (requestedTypes.has('semantic')) {
      candidatePromises.push(this.semantic.query(query));
    }
    if (requestedTypes.has('profile')) {
      candidatePromises.push(this.profile.query(query));
    }
    if (requestedTypes.has('working') && query.task?.id) {
      const wm = this.workingMemories.get(query.task.id);
      if (wm && !wm.isDestroyed) {
        candidatePromises.push(wm.query(query));
      }
    }

    const candidateBatches = await Promise.all(candidatePromises);
    const candidates: MemoryRecord[] = candidateBatches.flat();

    if (candidates.length === 0) {
      return [];
    }

    // 2. Score and rank candidates
    const ranked = candidates.map((rec) => this.scoreRecord(rec, query));

    // Sort descending by score
    ranked.sort((a, b) => b.score - a.score);

    // 3. Filter by minimum score and limit
    const minScore = query.minScore ?? 0.15;
    const limit = Math.min(query.limit ?? this.defaultLimit, 10);

    const filtered = ranked.filter((r) => r.score >= minScore).slice(0, limit);

    logger.debug(
      `MemoryEngine: Retrieved ${filtered.length}/${candidates.length} memories for task [${query.task.id}]`
    );

    return filtered;
  }

  /**
   * Scores an individual memory record against task ranking factors:
   * - Relevance to task (0.40)
   * - Recency (0.20)
   * - Project priority (0.20)
   * - Exact identifier match (0.20)
   */
  private scoreRecord(record: MemoryRecord, query: MemoryQuery): RankedMemoryRecord {
    const factors: MemoryRankingFactors = {
      relevance: this.calculateRelevance(record, query),
      recency: this.calculateRecency(record),
      priority: this.calculatePriority(record),
      exactMatch: this.isExactMatch(record, query),
    };

    const exactMatchWeight = factors.exactMatch ? 0.20 : 0.0;
    const score = Number(
      (
        factors.relevance * 0.40 +
        factors.recency * 0.20 +
        factors.priority * 0.20 +
        exactMatchWeight
      ).toFixed(4)
    );

    return {
      ...record,
      score,
      rankingFactors: factors,
    };
  }

  private calculateRelevance(record: MemoryRecord, query: MemoryQuery): number {
    const taskName = (query.task.name || '').toLowerCase();
    const taskArgsStr = JSON.stringify(query.task.arguments || {}).toLowerCase();
    const taskText = `${taskName} ${taskArgsStr}`;

    const contentStr = (
      typeof record.content === 'string'
        ? record.content
        : JSON.stringify(record.content)
    ).toLowerCase();

    // Direct query keywords match
    const keywords = (query.keywords || []).map((k) => k.toLowerCase());
    if (keywords.length > 0) {
      const matchCount = keywords.filter((k) => contentStr.includes(k)).length;
      return Math.min(matchCount / keywords.length, 1.0);
    }

    // Task text word match
    const words = taskText
      .split(/[\s,._\-:{}"]+/)
      .filter((w) => w.length > 3);

    let hits = 0;
    // Boost if toolSlug matches
    if (record.toolSlug && query.task.toolSlug && record.toolSlug === query.task.toolSlug) {
      hits += 3;
    }

    if (words.length === 0) return hits > 0 ? 0.9 : 0.5;

    for (const w of words) {
      if (contentStr.includes(w)) hits++;
    }

    return Math.min(hits / Math.min(words.length, 5), 1.0);
  }

  private calculateRecency(record: MemoryRecord): number {
    if (!record.timestamp) {
      // Profile memory is stable, not time-decayed
      return record.type === 'profile' ? 0.8 : 0.4;
    }

    const ts = new Date(record.timestamp).getTime();
    if (isNaN(ts)) return 0.4;

    const ageMs = Date.now() - ts;
    const minutes = ageMs / (1000 * 60);

    if (minutes < 5) return 1.0;
    if (minutes < 60) return 0.85;
    if (minutes < 1440) return 0.70; // 1 day
    if (minutes < 10080) return 0.50; // 7 days
    return 0.30;
  }

  private calculatePriority(record: MemoryRecord): number {
    if (typeof record.priority === 'number') {
      return Math.min(Math.max(record.priority, 0.0), 1.0);
    }
    // Profile is high priority by default
    if (record.type === 'profile') return 0.9;
    if (record.type === 'working') return 0.8;
    if (record.type === 'semantic') return 0.7;
    return 0.5;
  }

  private isExactMatch(record: MemoryRecord, query: MemoryQuery): boolean {
    const task = query.task;
    if (record.toolSlug && task.toolSlug && record.toolSlug === task.toolSlug) {
      return true;
    }
    if (record.taskId && task.id && record.taskId === task.id) {
      return true;
    }
    if (record.key && task.arguments && task.arguments[record.key] !== undefined) {
      return true;
    }
    return false;
  }
}
