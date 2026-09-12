import { CharacterAnalysis } from './models/character.js';

export class CharacterEngine {
  public analyze(text: string): CharacterAnalysis {
    const normalized = text.normalize('NFC');
    const hasNumbers = /\d/.test(normalized);
    const hasLetters = /[a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(normalized);
    const hasSymbols = /[\p{P}\p{S}]/u.test(normalized);

    return {
      length: normalized.length,
      hasNumbers,
      hasSymbols,
      hasLetters
    };
  }
}
