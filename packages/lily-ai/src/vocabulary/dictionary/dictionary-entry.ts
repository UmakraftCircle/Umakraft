export interface DictionaryEntry {
  word: string;
  normalizedWord: string;
  partOfSpeech: string;
  definitions: string[];
  examples?: string[];
  aliases?: string[];
  confidence: number;
}

export type UnknownWordStatus = 'unknown_word';

export interface DictionaryLookupSuccess {
  found: true;
  entry: DictionaryEntry;
  word: string;
  normalized: string;
  confidence: number;
  definitions: string[];
  examples?: string[];
  partOfSpeech: string;
}

export interface DictionaryLookupFailure {
  found: false;
  status: UnknownWordStatus;
  word: string;
  normalized?: string;
}

export type DictionaryLookupResult = DictionaryLookupSuccess | DictionaryLookupFailure;

export interface DictionaryResolutionResult {
  found: boolean;
  status?: UnknownWordStatus;
  word: string;
  normalized: string;
  entry?: DictionaryEntry;
  definitions?: string[];
  examples?: string[];
  partOfSpeech?: string;
  confidence?: number;
}
