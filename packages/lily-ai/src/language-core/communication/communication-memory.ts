export interface LongTermCommProfile {
  preferredStyle?: string;
  preferredTone?: string;
  totalInteractions: number;
}

export class CommunicationMemory {
  private memory = new Map<string, LongTermCommProfile>();

  public get(userId: string): LongTermCommProfile | undefined {
    return this.memory.get(userId);
  }

  public recordInteraction(userId: string, style: string, tone: string): void {
    const existing = this.get(userId) || { totalInteractions: 0 };
    this.memory.set(userId, {
      preferredStyle: style,
      preferredTone: tone,
      totalInteractions: existing.totalInteractions + 1
    });
  }

  public clear(): void {
    this.memory.clear();
  }
}
