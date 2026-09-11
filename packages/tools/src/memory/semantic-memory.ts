import { MemoryRecord, MemoryQuery, MemorySource } from './types.js';

export interface SemanticFact {
  id: string;
  category: 'observation' | 'rule' | 'knowledge' | 'lesson';
  content: string;
  toolSlug?: string;
  tags?: string[];
  priority?: number;
  timestamp?: string;
  metadata?: Record<string, any>;
}

/**
 * SemanticMemory: Manages long-term project knowledge, adaptation patterns,
 * error lessons, and general domain insights.
 */
export class SemanticMemory implements MemorySource {
  public readonly type = 'semantic';
  private facts: Map<string, SemanticFact> = new Map();

  constructor(initialFacts: SemanticFact[] = []) {
    for (const f of initialFacts) {
      this.facts.set(f.id, f);
    }
  }

  public addFact(fact: Omit<SemanticFact, 'id'> & { id?: string }): SemanticFact {
    const id = fact.id || `sem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullFact: SemanticFact = {
      ...fact,
      id,
      timestamp: fact.timestamp || new Date().toISOString(),
    };
    this.facts.set(id, fullFact);
    return fullFact;
  }

  public getFact(id: string): SemanticFact | undefined {
    return this.facts.get(id);
  }

  public clear(): void {
    this.facts.clear();
  }

  public async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    const task = query.task;
    const taskNameLower = (task.name || '').toLowerCase();
    const taskToolSlug = query.toolSlug || task.toolSlug;
    const keywords = (query.keywords || []).map((k) => k.toLowerCase());

    const records: MemoryRecord[] = [];

    for (const fact of this.facts.values()) {
      let isRelevant = false;
      let exactMatch = false;

      // Exact tool match
      if (fact.toolSlug && taskToolSlug && fact.toolSlug === taskToolSlug) {
        isRelevant = true;
        exactMatch = true;
      }

      // Keyword match
      const contentLower = fact.content.toLowerCase();
      if (keywords.length > 0 && keywords.some((k) => contentLower.includes(k))) {
        isRelevant = true;
      }

      // Task name or tag match
      if (fact.tags && fact.tags.some((t) => taskNameLower.includes(t.toLowerCase()))) {
        isRelevant = true;
      }

      if (isRelevant) {
        records.push({
          id: fact.id,
          type: 'semantic',
          content: fact.content,
          timestamp: fact.timestamp,
          priority: fact.priority ?? 0.7,
          toolSlug: fact.toolSlug,
          tags: fact.tags,
          metadata: {
            category: fact.category,
            exactMatch,
            ...fact.metadata,
          },
        });
      }
    }

    return records;
  }
}
