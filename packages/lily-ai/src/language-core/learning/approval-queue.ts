export type CandidateType = 'dictionary' | 'glossary' | 'taxonomy';

export interface LearningCandidate {
  id: string;
  type: CandidateType | string;
  candidateType?: CandidateType | string;
  term?: string;
  word?: string;
  candidate?: string;
  value: string;
  confidence: number;
  evidence: string[];
  domain?: string;
  metadata?: Record<string, any>;
  status?: 'pending_review' | 'approved' | 'rejected';
  createdAt?: Date;
}

export class ApprovalQueue {
  private queue = new Map<string, LearningCandidate>();

  /**
   * Submits a candidate to the approval queue for human/developer review.
   */
  public submit(candidate: Omit<LearningCandidate, 'status' | 'createdAt'> & { id?: string }): LearningCandidate {
    const id = candidate.id || `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fullCandidate: LearningCandidate = {
      ...candidate,
      id,
      status: 'pending_review',
      createdAt: new Date()
    };

    this.queue.set(id, fullCandidate);
    return fullCandidate;
  }

  public get(id: string): LearningCandidate | undefined {
    return this.queue.get(id);
  }

  public getPending(): LearningCandidate[] {
    return Array.from(this.queue.values()).filter(c => c.status === 'pending_review');
  }

  public getAll(): LearningCandidate[] {
    return Array.from(this.queue.values());
  }

  public approve(id: string): LearningCandidate | undefined {
    const candidate = this.queue.get(id);
    if (candidate) {
      candidate.status = 'approved';
      return candidate;
    }
    return undefined;
  }

  public reject(id: string): LearningCandidate | undefined {
    const candidate = this.queue.get(id);
    if (candidate) {
      candidate.status = 'rejected';
      return candidate;
    }
    return undefined;
  }

  public clear(): void {
    this.queue.clear();
  }

  public size(): number {
    return this.queue.size;
  }
}
