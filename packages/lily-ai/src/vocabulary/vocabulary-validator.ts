import { VocabularyRegistry } from './vocabulary-registry.js';

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  entryCount: number;
}

export class VocabularyValidator {
  public static readonly VALID_PARTS_OF_SPEECH = new Set<string>([
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

  public static validate(registry: VocabularyRegistry): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenWords = new Set<string>();
    const entries = registry.getAll();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const indexStr = `Entry #${i + 1}`;

      // Check 1: Empty Entry / Word
      if (!entry.word || entry.word.trim() === '') {
        errors.push(`${indexStr}: Word is empty or missing`);
        continue;
      }

      const normalizedWord = entry.word.trim().toLowerCase();

      // Check 2: Missing Definition
      if (!entry.definition || entry.definition.trim() === '') {
        errors.push(`${indexStr} ('${entry.word}'): Definition is empty or missing`);
      }

      // Check 3: Invalid Type (Part of speech)
      if (!entry.partOfSpeech || entry.partOfSpeech.trim() === '') {
        errors.push(`${indexStr} ('${entry.word}'): Part of speech is empty or missing`);
      } else {
        const normalizedPos = entry.partOfSpeech.trim().toLowerCase();
        if (!this.VALID_PARTS_OF_SPEECH.has(normalizedPos)) {
          errors.push(`${indexStr} ('${entry.word}'): Invalid part of speech '${entry.partOfSpeech}'`);
        }
      }

      // Check 4: Duplicate Word
      if (seenWords.has(normalizedWord)) {
        errors.push(`Duplicate word detected: '${normalizedWord}'`);
      } else {
        seenWords.add(normalizedWord);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      entryCount: entries.length
    };
  }
}
