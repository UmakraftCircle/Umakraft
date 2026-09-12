export interface LexicalResult {
  term: string;
  normalizedTerm?: string;
  definition?: string;
  definitions?: string[];
  partOfSpeech?: string;
  synonyms?: string[];
  antonyms?: string[];
  phraseMeaning?: string;
  isPhrase?: boolean;
  phraseExpansions?: string[];
  oppositePhrases?: string[];
  candidate?: boolean;
  candidateInfo?: {
    term: string;
    category?: string;
    frequency?: number;
    confidence?: number;
    suggestedDefinition?: string;
  };
  confidence: number;
  source: string;
  subsystem?: string;
  sources?: string[];
  context?: string;
  semanticScore?: number;
  metadata?: Record<string, unknown>;
}
