export interface ReasoningPatternTemplate {
  type: string;
  condition: string;
  description: string;
  frequency: number;
  lastObserved?: string;
  metadata?: Record<string, any>;
}

export class ReasoningMemory {
  private patterns: Map<string, ReasoningPatternTemplate> = new Map();

  constructor() {
    // Seed core reasoning pattern archetypes
    this.record(
      'goal_gap',
      'current < required',
      'Discrepancy between current state and target threshold'
    );
    this.record(
      'goal_achieved',
      'current >= required',
      'Current state meets or exceeds target threshold'
    );
    this.record(
      'stat_bottleneck',
      'stat < threshold',
      'Attribute below minimum requirement for scenario'
    );
    this.record(
      'consecutive_failure',
      'losses >= 3',
      'Recurring failure pattern under similar conditions'
    );
  }

  /**
   * Records or updates a reusable reasoning pattern archetype
   */
  public record(
    type: string,
    condition: string,
    description: string,
    metadata?: Record<string, any>
  ): ReasoningPatternTemplate {
    const existing = this.patterns.get(type);
    if (existing) {
      existing.frequency += 1;
      existing.condition = condition;
      existing.description = description;
      existing.lastObserved = new Date().toISOString();
      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
      return existing;
    }

    const newTemplate: ReasoningPatternTemplate = {
      type,
      condition,
      description,
      frequency: 1,
      lastObserved: new Date().toISOString(),
      metadata
    };
    this.patterns.set(type, newTemplate);
    return newTemplate;
  }

  public get(type: string): ReasoningPatternTemplate | undefined {
    return this.patterns.get(type);
  }

  public has(type: string): boolean {
    return this.patterns.has(type);
  }

  public getAll(): ReasoningPatternTemplate[] {
    return Array.from(this.patterns.values());
  }

  public findPattern(condition: string): ReasoningPatternTemplate | undefined {
    const normalizedCond = condition.toLowerCase().replace(/\s+/g, '');
    for (const pattern of this.patterns.values()) {
      if (pattern.condition.toLowerCase().replace(/\s+/g, '') === normalizedCond) {
        return pattern;
      }
    }
    return undefined;
  }

  public clear(): void {
    this.patterns.clear();
  }

  public size(): number {
    return this.patterns.size;
  }
}
