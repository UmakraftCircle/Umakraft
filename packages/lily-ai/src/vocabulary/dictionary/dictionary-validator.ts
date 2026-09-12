import { DictionaryRegistry } from './dictionary-registry.js';
import { DictionaryEntry } from './dictionary-entry.js';

export interface DictionaryValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalEntries: number;
}

export const VALID_PARTS_OF_SPEECH = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'phrase',
  'abbreviation'
]);

export class DictionaryValidator {
  /**
   * Validates all entries inside a DictionaryRegistry.
   */
  public static validate(registry: DictionaryRegistry): DictionaryValidationReport {
    const entries = registry.getAll();
    return this.validateEntries(entries);
  }

  /**
   * Validates an array of DictionaryEntry items.
   */
  public static validateEntries(entries: DictionaryEntry[]): DictionaryValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenWords = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const indexStr = `Entry at index ${i}`;

      // 1. Word presence
      if (!entry.word || typeof entry.word !== 'string' || entry.word.trim().length === 0) {
        errors.push(`${indexStr}: missing or empty 'word' property`);
        continue;
      }

      const wordLower = entry.word.trim().toLowerCase();

      // 2. Duplicate detection
      if (seenWords.has(wordLower)) {
        errors.push(`${indexStr} ('${entry.word}'): duplicate entry detected for word '${wordLower}'`);
      }
      seenWords.add(wordLower);

      // 3. Definitions presence
      if (!entry.definitions || !Array.isArray(entry.definitions) || entry.definitions.length === 0) {
        errors.push(`${indexStr} ('${entry.word}'): definitions must be a non-empty array`);
      } else {
        const emptyDefs = entry.definitions.filter(d => !d || typeof d !== 'string' || d.trim().length === 0);
        if (emptyDefs.length > 0) {
          errors.push(`${indexStr} ('${entry.word}'): contains empty definition strings`);
        }
      }

      // 4. Part of speech validation
      if (!entry.partOfSpeech || typeof entry.partOfSpeech !== 'string') {
        errors.push(`${indexStr} ('${entry.word}'): missing or invalid 'partOfSpeech'`);
      } else {
        const posLower = entry.partOfSpeech.trim().toLowerCase();
        if (!VALID_PARTS_OF_SPEECH.has(posLower)) {
          errors.push(`${indexStr} ('${entry.word}'): invalid partOfSpeech '${entry.partOfSpeech}'. Must be one of: ${Array.from(VALID_PARTS_OF_SPEECH).join(', ')}`);
        }
      }

      // 5. Confidence validation
      if (typeof entry.confidence !== 'number' || isNaN(entry.confidence) || entry.confidence < 0 || entry.confidence > 1) {
        errors.push(`${indexStr} ('${entry.word}'): confidence must be a number between 0.0 and 1.0`);
      }

      // 6. Examples warnings
      if (!entry.examples || entry.examples.length === 0) {
        warnings.push(`${indexStr} ('${entry.word}'): no usage examples provided`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      totalEntries: entries.length
    };
  }
}
