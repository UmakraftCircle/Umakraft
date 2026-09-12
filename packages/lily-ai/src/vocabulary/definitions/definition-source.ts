export interface DefinitionSource {
  id: string;
  name: string;
  authority: number;
  confidence: number;
  description?: string;
  isLocal?: boolean;
}

export const DEFINITION_SOURCES: Record<string, DefinitionSource> = {
  CURATED: {
    id: 'curated_dictionary',
    name: 'Local Curated Dictionary',
    authority: 100,
    confidence: 1.0,
    description: 'Manually verified and domain-curated official definitions',
    isLocal: true
  },
  WIKTIONARY: {
    id: 'wiktionary',
    name: 'Wiktionary Offline Export',
    authority: 85,
    confidence: 0.95,
    description: 'Extracted English Wiktionary offline dump and lexical database',
    isLocal: true
  },
  WORDNET: {
    id: 'wordnet',
    name: 'WordNet Lexical Database',
    authority: 75,
    confidence: 0.90,
    description: 'Princeton WordNet semantic and relational dictionary',
    isLocal: true
  },
  LEARNED: {
    id: 'learned_candidate',
    name: 'Learned Vocabulary Candidate',
    authority: 50,
    confidence: 0.70,
    description: 'Machine-inferred or contextual candidate definition pending verification',
    isLocal: true
  }
};

export interface Definition {
  id?: string;
  word: string;
  definition: string;
  partOfSpeech?: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | string;
  context?: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  source: string;
  authority: number;
  confidence: number;
  tags?: string[];
  timestamp?: number;
}

export interface DefinitionLookupOptions {
  context?: string;
  taxonomy?: string[];
  glossary?: string[];
  query?: string;
  partOfSpeech?: string;
  minConfidence?: number;
  source?: string;
  limit?: number;
}

export interface DefinitionLookupResult {
  found: boolean;
  word: string;
  selectedDefinition?: Definition;
  definitions: Definition[];
  bestDefinition?: string;
  source: string;
  confidence: number;
  rankingReasons?: string[];
  matchType?: 'exact' | 'alias' | 'stem' | 'fuzzy' | 'none';
}

export interface DefinitionRankedItem {
  definition: Definition;
  score: number;
  reasons: string[];
}
