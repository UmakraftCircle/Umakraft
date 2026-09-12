export interface AntonymRelation {
  antonym: string;
  confidence: number;
  context?: string;
  partOfSpeech?: string;
}

export interface AntonymEntry {
  word: string;
  antonyms: string[];
  confidence: number;
  context?: string;
  partOfSpeech?: string;
  relations?: AntonymRelation[];
}

export interface AntonymLookupOptions {
  context?: string;
  minConfidence?: number;
  limit?: number;
  partOfSpeech?: string;
}

export interface AntonymLookupResult {
  found: boolean;
  word: string;
  antonyms: string[];
  relations: AntonymRelation[];
  confidence: number;
  context?: string;
}

export interface AntonymExpansionOptions {
  maxExpansionsPerTerm?: number;
  minConfidence?: number;
  context?: string;
  includeOriginal?: boolean;
}

export interface AntonymExpansionResult {
  originalQuery: string;
  tokens: string[];
  tokenAntonyms: Record<string, string[]>;
  oppositeTerms: string[];
  oppositePhrases: string[];
}

export interface ContradictionPair {
  termA: string;
  termB: string;
  field?: string;
  confidence: number;
  context?: string;
}

export interface ContradictionCheckResult {
  contradiction: boolean;
  confidence: number;
  contradictoryPairs: ContradictionPair[];
  explanation?: string;
}
