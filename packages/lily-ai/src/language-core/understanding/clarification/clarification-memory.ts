export interface ClarificationState {
  sessionId: string;
  type: 'direct' | 'guided' | 'top_match';
  step?: string;
  remainingSteps?: string[];
  data?: Record<string, any>;
}

export class ClarificationMemory {
  private memory = new Map<string, ClarificationState>();

  public get(sessionId: string): ClarificationState | undefined {
    return this.memory.get(sessionId);
  }

  public set(sessionId: string, state: ClarificationState): void {
    this.memory.set(sessionId, state);
  }

  public update(sessionId: string, updates: Partial<ClarificationState>): void {
    const existing = this.get(sessionId);
    if (existing) {
      this.memory.set(sessionId, {
        ...existing,
        ...updates,
        data: {
          ...existing.data,
          ...updates.data
        }
      });
    }
  }

  public delete(sessionId: string): void {
    this.memory.delete(sessionId);
  }

  public clear(): void {
    this.memory.clear();
  }
}
