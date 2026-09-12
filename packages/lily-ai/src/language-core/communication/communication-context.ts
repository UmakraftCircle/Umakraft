export interface CommContextState {
  lastTopic?: string;
  lastStrategy?: string;
  turnsActive: number;
}

export class CommunicationContext {
  private state = new Map<string, CommContextState>();

  public get(sessionId: string): CommContextState | undefined {
    return this.state.get(sessionId);
  }

  public set(sessionId: string, state: CommContextState): void {
    this.state.set(sessionId, state);
  }

  public update(sessionId: string, updates: Partial<CommContextState>): void {
    const existing = this.get(sessionId) || { turnsActive: 0 };
    this.state.set(sessionId, {
      ...existing,
      ...updates,
      turnsActive: existing.turnsActive + 1
    });
  }

  public delete(sessionId: string): void {
    this.state.delete(sessionId);
  }
}
