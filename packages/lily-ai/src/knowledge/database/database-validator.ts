import { DatabaseKnowledgeResult } from './database-result.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class DatabaseValidator {
  public validateResult(result: DatabaseKnowledgeResult): ValidationResult {
    const errors: string[] = [];

    if (!result.source || typeof result.source !== 'string') {
      errors.push('Source must be a non-empty string');
    }

    if (!result.entityType || typeof result.entityType !== 'string') {
      errors.push('EntityType must be a non-empty string');
    }

    if (!result.entityId || typeof result.entityId !== 'string') {
      errors.push('EntityId must be a non-empty string');
    }

    if (result.payload === undefined || result.payload === null) {
      errors.push('Payload cannot be null or undefined');
    }

    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      errors.push('Confidence must be a number between 0 and 1');
    }

    if (!(result.timestamp instanceof Date) || isNaN(result.timestamp.getTime())) {
      errors.push('Timestamp must be a valid Date instance');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public validateTrainerId(trainerId: string): boolean {
    return typeof trainerId === 'string' && trainerId.trim().length > 0;
  }

  public validateFanCount(fans: number): boolean {
    return typeof fans === 'number' && !isNaN(fans) && fans >= 0;
  }
}
