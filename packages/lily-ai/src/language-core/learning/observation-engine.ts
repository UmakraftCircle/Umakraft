export interface Observation {
  term: string;
  frequency: number;
  lastObserved: Date;
  contexts?: string[];
  metadata?: Record<string, any>;
}

export class ObservationEngine {
  private observations = new Map<string, Observation>();

  /**
   * Records or increments an observation of a term/phrase.
   */
  public observe(term: string, context?: string, count: number = 1): Observation {
    const normalized = term.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Observed term cannot be empty');
    }

    const existing = this.observations.get(normalized);
    if (existing) {
      existing.frequency += count;
      existing.lastObserved = new Date();
      if (context) {
        if (!existing.contexts) existing.contexts = [];
        if (!existing.contexts.includes(context)) {
          existing.contexts.push(context);
        }
      }
      return existing;
    }

    const newObs: Observation = {
      term: normalized,
      frequency: count,
      lastObserved: new Date(),
      contexts: context ? [context] : []
    };
    this.observations.set(normalized, newObs);
    return newObs;
  }

  public getObservation(term: string): Observation | undefined {
    return this.observations.get(term.trim().toLowerCase());
  }

  public getAll(): Observation[] {
    return Array.from(this.observations.values()).sort((a, b) => b.frequency - a.frequency);
  }

  public clear(): void {
    this.observations.clear();
  }

  public size(): number {
    return this.observations.size;
  }
}
