import { AgentTask } from '@ai-agent-platform/shared';

/**
 * Supported memory classifications.
 * Independent memory sources merged only by the Context Loader.
 */
export type MemoryType = 'session' | 'semantic' | 'profile' | 'working';

/**
 * Standard memory record representation.
 */
export interface MemoryRecord {
  id: string;
  type: MemoryType;
  content: string | Record<string, any>;
  timestamp?: string;
  priority?: number; // 0.0 - 1.0 or 1 - 10
  tags?: string[];
  metadata?: Record<string, any>;
  // Identifier fields for exact matching
  toolSlug?: string;
  taskId?: string;
  key?: string;
}

/**
 * Breakdown of scoring factors for retrieved memories.
 */
export interface MemoryRankingFactors {
  relevance: number;  // Relevance to current task (keyword / semantic overlap)
  recency: number;    // Temporal recency score
  priority: number;   // Project / configuration priority
  exactMatch: boolean;// Exact identifier match (toolSlug, taskId, key)
}

/**
 * Ranked memory record returned by the MemoryEngine.
 */
export interface RankedMemoryRecord extends MemoryRecord {
  score: number;
  rankingFactors: MemoryRankingFactors;
}

/**
 * Query specification passed to MemoryEngine by the Context Loader.
 */
export interface MemoryQuery {
  task: AgentTask;
  intent?: string;
  toolSlug?: string;
  keywords?: string[];
  types?: MemoryType[];
  limit?: number;
  minScore?: number;
}

/**
 * Interface for an independent memory source.
 */
export interface MemorySource {
  readonly type: MemoryType;
  query(query: MemoryQuery): Promise<MemoryRecord[]>;
}
