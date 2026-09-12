export interface LearningMemoryRecord {
  term: string;
  seen: number;
  status: 'pending_review' | 'observing' | 'approved' | 'rejected' | 'candidate';
  candidateType?: string;
  confidence?: number;
  firstSeen: Date;
  lastSeen: Date;
  history?: string[];
}

export class LearningMemory {
  private records = new Map<string, LearningMemoryRecord>();

  /**
   * Tracks learning history for a term.
   * Separate from Conversation Memory, User Memory, or Knowledge Memory.
   */
  public track(term: string, seenCount: number = 1, status: LearningMemoryRecord['status'] = 'observing', candidateType?: string): LearningMemoryRecord {
    const key = term.trim().toLowerCase();
    const existing = this.records.get(key);

    if (existing) {
      existing.seen += seenCount;
      existing.lastSeen = new Date();
      if (status !== 'observing') {
        existing.status = status;
      }
      if (candidateType) {
        existing.candidateType = candidateType;
      }
      return existing;
    }

    const newRecord: LearningMemoryRecord = {
      term: key,
      seen: seenCount,
      status,
      candidateType,
      firstSeen: new Date(),
      lastSeen: new Date()
    };
    this.records.set(key, newRecord);
    return newRecord;
  }

  public get(term: string): LearningMemoryRecord | undefined {
    return this.records.get(term.trim().toLowerCase());
  }

  public updateStatus(term: string, status: LearningMemoryRecord['status']): boolean {
    const record = this.records.get(term.trim().toLowerCase());
    if (record) {
      record.status = status;
      return true;
    }
    return false;
  }

  public getAll(): LearningMemoryRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.seen - a.seen);
  }

  public clear(): void {
    this.records.clear();
  }

  public size(): number {
    return this.records.size;
  }
}
