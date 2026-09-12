import { ExtractedEntity } from './language-analysis.js';

export class EntityExtractor {
  public extract(message: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const identifiedTrainerIds = new Set<string>();

    // 1. Look for contextual trainer ID phrases (e.g. "trainer 123456", "trainer id is 123456", "trainer id: 123456", "my id is 123456")
    const contextualRegex = /(?:trainer\s*(?:id)?\s*(?:is|:)?\s*|show\s+trainer\s+|lookup\s+trainer\s+|find\s+trainer\s+|who\s+is\s+trainer\s+|my\s+id\s*(?:is|:)?\s*)(\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = contextualRegex.exec(message)) !== null) {
      const id = match[1];
      if (id && !identifiedTrainerIds.has(id)) {
        identifiedTrainerIds.add(id);
        entities.push({ value: id, type: 'trainer_id' });
      }
    }

    // 2. Look for 9 digit numbers which are standard game trainer IDs
    const nineDigitMatch = message.match(/\b\d{9}\b/g);
    if (nineDigitMatch) {
      nineDigitMatch.forEach(id => {
        if (!identifiedTrainerIds.has(id)) {
          identifiedTrainerIds.add(id);
          entities.push({ value: id, type: 'trainer_id' });
        }
      });
    }

    // 3. Look for general numbers that were not identified as trainer IDs
    const allNumberMatches = message.match(/\b\d+\b/g);
    if (allNumberMatches) {
      allNumberMatches.forEach(num => {
        if (!identifiedTrainerIds.has(num)) {
          entities.push({ value: num, type: 'number' });
        }
      });
    }

    return entities;
  }
}
