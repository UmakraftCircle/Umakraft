export interface VocabularyResult {
  word: string;
  definition: string;
  partOfSpeech: string;
  confidence: number;
  language?: string;
  normalized?: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
}
