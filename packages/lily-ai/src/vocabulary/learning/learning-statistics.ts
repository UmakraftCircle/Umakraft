import { CandidateCategory, CandidateStatus } from './learning-policy.js';

export interface LearningStatisticsData {
  candidatesObserved: number;
  candidatesPending: number;
  candidatesApproved: number;
  candidatesRejected: number;
  candidatesPromoted: number;
  totalObservations: number;
  categoryBreakdown: Record<CandidateCategory, number>;
  learningAccuracy: number;
  lastActivityTimestamp: number;
}

export class LearningStatistics {
  private candidatesObserved: number = 0;
  private candidatesPending: number = 0;
  private candidatesApproved: number = 0;
  private candidatesRejected: number = 0;
  private candidatesPromoted: number = 0;
  private totalObservations: number = 0;
  private categoryCounts: Record<CandidateCategory, number> = {
    general: 0,
    community: 0,
    racing: 0,
    slang: 0,
    shorthand: 0
  };
  private lastActivityTimestamp: number = Date.now();

  public recordObservation(category: CandidateCategory = 'general', isNewCandidate: boolean = false): void {
    this.totalObservations++;
    if (isNewCandidate) {
      this.candidatesObserved++;
      this.candidatesPending++;
      this.categoryCounts[category] = (this.categoryCounts[category] || 0) + 1;
    }
    this.lastActivityTimestamp = Date.now();
  }

  public recordApproval(): void {
    if (this.candidatesPending > 0) this.candidatesPending--;
    this.candidatesApproved++;
    this.lastActivityTimestamp = Date.now();
  }

  public recordRejection(): void {
    if (this.candidatesPending > 0) this.candidatesPending--;
    this.candidatesRejected++;
    this.lastActivityTimestamp = Date.now();
  }

  public recordPromotion(): void {
    if (this.candidatesApproved > 0) this.candidatesApproved--;
    this.candidatesPromoted++;
    this.lastActivityTimestamp = Date.now();
  }

  public recalculate(candidates: Array<{ status: CandidateStatus; category: CandidateCategory }>): void {
    this.candidatesObserved = candidates.length;
    this.candidatesPending = candidates.filter(c => c.status === 'PENDING').length;
    this.candidatesApproved = candidates.filter(c => c.status === 'APPROVED').length;
    this.candidatesRejected = candidates.filter(c => c.status === 'REJECTED').length;
    this.candidatesPromoted = candidates.filter(c => c.status === 'PROMOTED').length;

    this.categoryCounts = {
      general: 0,
      community: 0,
      racing: 0,
      slang: 0,
      shorthand: 0
    };

    for (const c of candidates) {
      this.categoryCounts[c.category] = (this.categoryCounts[c.category] || 0) + 1;
    }
    this.lastActivityTimestamp = Date.now();
  }

  public getSnapshot(): LearningStatisticsData {
    const totalDecisions = this.candidatesPromoted + this.candidatesRejected;
    const accuracy = totalDecisions > 0
      ? Number((this.candidatesPromoted / totalDecisions).toFixed(4))
      : 1.0;

    return {
      candidatesObserved: this.candidatesObserved,
      candidatesPending: this.candidatesPending,
      candidatesApproved: this.candidatesApproved,
      candidatesRejected: this.candidatesRejected,
      candidatesPromoted: this.candidatesPromoted,
      totalObservations: this.totalObservations,
      categoryBreakdown: { ...this.categoryCounts },
      learningAccuracy: accuracy,
      lastActivityTimestamp: this.lastActivityTimestamp
    };
  }

  public reset(): void {
    this.candidatesObserved = 0;
    this.candidatesPending = 0;
    this.candidatesApproved = 0;
    this.candidatesRejected = 0;
    this.candidatesPromoted = 0;
    this.totalObservations = 0;
    this.categoryCounts = {
      general: 0,
      community: 0,
      racing: 0,
      slang: 0,
      shorthand: 0
    };
    this.lastActivityTimestamp = Date.now();
  }
}
