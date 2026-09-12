export class AmbiguityEngine {
  private ambiguousTriggers = [
    { phrase: 'speed parent', options: ['Speed Factor', 'Speed Build', 'Speed Support'] },
    { phrase: 'stamina parent', options: ['Stamina Factor', 'Stamina Build', 'Stamina Support'] },
    { phrase: 'speed thing', options: ['Speed Stat', 'Speed Card', 'Speed Factor'] },
    { phrase: 'how to train', options: ['Training build', 'Training facility levels', 'Training schedule'] }
  ];

  /**
   * Identifies if a phrase is structurally ambiguous and requires user clarification
   */
  public analyze(text: string): { ambiguous: boolean; clarificationNeeded: boolean; options?: string[] } {
    const normalized = text.toLowerCase();

    for (const trigger of this.ambiguousTriggers) {
      if (normalized.includes(trigger.phrase)) {
        return {
          ambiguous: true,
          clarificationNeeded: true,
          options: trigger.options
        };
      }
    }

    // Check if user says something too short/unspecific
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 2 && (normalized.includes('parent') || normalized.includes('speed') || normalized.includes('stamina'))) {
      // e.g. "speed parent" or "need speed"
      if (!normalized.includes('build') && !normalized.includes('factor') && !normalized.includes('card')) {
        return {
          ambiguous: true,
          clarificationNeeded: true,
          options: ['Build Help', 'Parent Search', 'Glossary Definition']
        };
      }
    }

    return {
      ambiguous: false,
      clarificationNeeded: false
    };
  }
}
