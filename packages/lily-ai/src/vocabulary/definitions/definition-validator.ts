import { Definition } from './definition-source.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class DefinitionValidator {
  /**
   * Validates a single Definition item.
   */
  public static validate(entry: Partial<Definition>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!entry.word || typeof entry.word !== 'string' || entry.word.trim().length === 0) {
      errors.push("Definition entry must have a non-empty 'word'");
    }

    if (!entry.definition || typeof entry.definition !== 'string' || entry.definition.trim().length < 3) {
      errors.push("Definition entry must have a non-empty 'definition' of at least 3 characters");
    }

    if (!entry.source || typeof entry.source !== 'string') {
      errors.push("Definition entry must specify a valid 'source'");
    }

    if (entry.confidence !== undefined) {
      if (typeof entry.confidence !== 'number' || isNaN(entry.confidence) || entry.confidence < 0 || entry.confidence > 1) {
        errors.push("Confidence score must be a number between 0.0 and 1.0");
      }
    }

    if (entry.authority !== undefined) {
      if (typeof entry.authority !== 'number' || isNaN(entry.authority) || entry.authority < 0 || entry.authority > 100) {
        errors.push("Authority must be an integer between 0 and 100");
      }
    }

    if (entry.examples && !Array.isArray(entry.examples)) {
      errors.push("Examples must be an array of strings if specified");
    }

    if (entry.tags && !Array.isArray(entry.tags)) {
      errors.push("Tags must be an array of strings if specified");
    }

    if (!entry.context) {
      warnings.push(`Definition for '${entry.word}' does not have an explicit context specified; defaulting to 'general'`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates a collection of definitions.
   */
  public static validateBatch(entries: Partial<Definition>[]): {
    valid: boolean;
    validCount: number;
    invalidCount: number;
    issues: Array<{ index: number; word?: string; errors: string[] }>;
  } {
    let validCount = 0;
    let invalidCount = 0;
    const issues: Array<{ index: number; word?: string; errors: string[] }> = [];

    for (let i = 0; i < entries.length; i++) {
      const res = this.validate(entries[i]);
      if (res.valid) {
        validCount++;
      } else {
        invalidCount++;
        issues.push({
          index: i,
          word: entries[i].word,
          errors: res.errors
        });
      }
    }

    return {
      valid: invalidCount === 0,
      validCount,
      invalidCount,
      issues
    };
  }
}
