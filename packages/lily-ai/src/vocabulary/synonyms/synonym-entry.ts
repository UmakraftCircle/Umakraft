export interface SynonymRelation {
  synonym: string;
  confidence: number;
  context?: string;
  partOfSpeech?: string;
}

export interface SynonymEntry {
  word: string;
  synonyms: string[];
  confidence: number;
  context?: string;
  partOfSpeech?: string;
  relations?: SynonymRelation[];
}

export interface SynonymLookupOptions {
  context?: string;
  minConfidence?: number;
  limit?: number;
  partOfSpeech?: string;
}

export interface SynonymLookupResult {
  found: boolean;
  word: string;
  synonyms: string[];
  relations: SynonymRelation[];
  confidence: number;
  context?: string;
}

export interface SynonymExpansionOptions {
  maxExpansionsPerTerm?: number;
  minConfidence?: number;
  context?: string;
  includeOriginal?: boolean;
}

export interface SynonymExpansionResult {
  originalQuery: string;
  tokens: string[];
  tokenExpansions: Record<string, string[]>;
  expandedTerms: string[];
  expandedPhrases: string[];
}
