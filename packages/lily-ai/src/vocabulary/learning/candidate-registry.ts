import { CandidateCategory, CandidateStatus } from './learning-policy.js';

export interface CandidateScoreDetails {
  frequencyScore: number;
  userDiversityScore: number;
  linguisticScore: number;
  contextScore: number;
  temporalScore: number;
  communityBonus: number;
  compositeScore: number;
}

export interface CandidateOccurrence {
  term: string;
  timestamp: Date;
  contextSentence: string;
  userId?: string;
  channelId?: string;
}

export interface VocabularyCandidate {
  term: string;
  frequency: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  confidence: number;
  status: CandidateStatus;
  category: CandidateCategory;
  inferredMeaning?: string;
  partOfSpeech?: 'noun' | 'verb' | 'adjective' | 'adverb' | 'interjection' | 'phrase' | string;
  contextSamples: string[];
  uniqueUsers: string[];
  scoreDetails?: CandidateScoreDetails;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  promotedAt?: Date;
  promotedBy?: string;
  rejectionReason?: string;
  suggestedDefinition?: string;
  tags?: string[];
}

export class CandidateRegistry {
  private candidates: Map<string, VocabularyCandidate> = new Map();
  private occurrences: CandidateOccurrence[] = [];
  private maxOccurrencesLog: number;

  constructor(maxOccurrencesLog: number = 5000) {
    this.maxOccurrencesLog = maxOccurrencesLog;
  }

  /**
   * Records or increments observation of a vocabulary candidate.
   */
  public recordOccurrence(
    term: string,
    contextSentence: string = '',
    userId?: string,
    category: CandidateCategory = 'general'
  ): { candidate: VocabularyCandidate; isNew: boolean } {
    const normalizedTerm = term.trim().toLowerCase();
    const existing = this.candidates.get(normalizedTerm);
    const now = new Date();

    // Log occurrence
    this.occurrences.push({
      term: normalizedTerm,
      timestamp: now,
      contextSentence: contextSentence.trim(),
      userId
    });

    if (this.occurrences.length > this.maxOccurrencesLog) {
      this.occurrences.splice(0, this.occurrences.length - this.maxOccurrencesLog);
    }

    if (existing) {
      existing.frequency += 1;
      existing.lastSeenAt = now;

      if (contextSentence && !existing.contextSamples.includes(contextSentence.trim())) {
        if (existing.contextSamples.length < 10) {
          existing.contextSamples.push(contextSentence.trim());
        } else {
          existing.contextSamples.shift();
          existing.contextSamples.push(contextSentence.trim());
        }
      }

      if (userId && !existing.uniqueUsers.includes(userId)) {
        existing.uniqueUsers.push(userId);
      }

      // If category is provided and existing is general, allow specialization
      if (category !== 'general' && existing.category === 'general') {
        existing.category = category;
      }

      this.candidates.set(normalizedTerm, existing);
      return { candidate: existing, isNew: false };
    }

    // Create new candidate
    const newCandidate: VocabularyCandidate = {
      term: normalizedTerm,
      frequency: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      confidence: 0.05,
      status: 'PENDING',
      category,
      contextSamples: contextSentence ? [contextSentence.trim()] : [],
      uniqueUsers: userId ? [userId] : []
    };

    this.candidates.set(normalizedTerm, newCandidate);
    return { candidate: newCandidate, isNew: true };
  }

  public get(term: string): VocabularyCandidate | undefined {
    return this.candidates.get(term.trim().toLowerCase());
  }

  public has(term: string): boolean {
    return this.candidates.has(term.trim().toLowerCase());
  }

  public getAll(): VocabularyCandidate[] {
    return Array.from(this.candidates.values());
  }

  public getByStatus(status: CandidateStatus): VocabularyCandidate[] {
    return this.getAll().filter(c => c.status === status);
  }

  public getByCategory(category: CandidateCategory): VocabularyCandidate[] {
    return this.getAll().filter(c => c.category === category);
  }

  public update(candidate: VocabularyCandidate): void {
    this.candidates.set(candidate.term.trim().toLowerCase(), candidate);
  }

  public remove(term: string): boolean {
    return this.candidates.delete(term.trim().toLowerCase());
  }

  public clear(): void {
    this.candidates.clear();
    this.occurrences = [];
  }

  public count(): number {
    return this.candidates.size;
  }

  public getOccurrences(term?: string): CandidateOccurrence[] {
    if (!term) return [...this.occurrences];
    const target = term.trim().toLowerCase();
    return this.occurrences.filter(o => o.term === target);
  }
}
