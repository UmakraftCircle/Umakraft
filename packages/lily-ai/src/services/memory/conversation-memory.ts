export interface ConversationState {
  recentMessages: string[];
  lastIntent?: string;
}

export class ConversationMemory {
  private states = new Map<string, ConversationState>();

  public getState(userId: string): ConversationState {
    if (!this.states.has(userId)) {
      this.states.set(userId, { recentMessages: [] });
    }
    return this.states.get(userId)!;
  }

  public updateState(userId: string, data: Partial<ConversationState>) {
    const state = this.getState(userId);
    
    if (data.recentMessages) {
      // Append and keep only the last 10 messages for context window
      state.recentMessages = [...state.recentMessages, ...data.recentMessages].slice(-10);
    }
    
    if (data.lastIntent !== undefined) {
      state.lastIntent = data.lastIntent;
    }
  }
}
