import { MemoryRecord, MemoryQuery, MemorySource } from './types.js';

export interface SessionTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * SessionMemory: Isolates conversational history for the current session only.
 * Does not persist across unrelated sessions or leak long-term.
 */
export class SessionMemory implements MemorySource {
  public readonly type = 'session';
  private turns: SessionTurn[] = [];

  constructor(initialTurns: SessionTurn[] = []) {
    this.turns = [...initialTurns];
  }

  public addTurn(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, any>): SessionTurn {
    const turn: SessionTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };
    this.turns.push(turn);
    return turn;
  }

  public getTurns(): SessionTurn[] {
    return [...this.turns];
  }

  public clear(): void {
    this.turns = [];
  }

  public async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    const taskText = `${query.task.name || ''} ${JSON.stringify(query.task.arguments || {})}`.toLowerCase();
    const keywords = (query.keywords || []).map((k) => k.toLowerCase());

    const results: MemoryRecord[] = [];

    for (const turn of this.turns) {
      const contentLower = turn.content.toLowerCase();
      let matched = false;

      if (keywords.length > 0) {
        matched = keywords.some((k) => contentLower.includes(k));
      } else if (taskText.length > 0) {
        // Simple word overlap
        const words = taskText.split(/\s+/).filter((w) => w.length > 3);
        matched = words.some((w) => contentLower.includes(w));
      } else {
        matched = true;
      }

      if (matched) {
        results.push({
          id: turn.id,
          type: 'session',
          content: turn.content,
          timestamp: turn.timestamp,
          priority: 0.5,
          metadata: {
            role: turn.role,
            ...turn.metadata,
          },
        });
      }
    }

    return results;
  }
}
