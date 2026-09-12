export interface SessionState {
  activeTopic?: string;
  workingMemory: Record<string, any>;
}

export class SessionMemory {
  private sessions = new Map<string, SessionState>();

  public getSession(userId: string): SessionState {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, { workingMemory: {} });
    }
    return this.sessions.get(userId)!;
  }

  public updateSession(userId: string, data: Partial<SessionState>) {
    const session = this.getSession(userId);
    
    if (data.activeTopic !== undefined) {
      session.activeTopic = data.activeTopic;
    }
    
    if (data.workingMemory) {
      session.workingMemory = { ...session.workingMemory, ...data.workingMemory };
    }
  }

  public clearWorkingMemory(userId: string) {
    const session = this.getSession(userId);
    session.workingMemory = {};
  }
}
