export interface LexicalQueryOptions {
  includeSynonyms?: boolean;
  includeAntonyms?: boolean;
  includePhrases?: boolean;
  includeDefinitions?: boolean;
  expand?: boolean;
  trackCandidates?: boolean;
  maxSynonyms?: number;
  maxAntonyms?: number;
  minConfidence?: number;
}

export interface LexicalQuery {
  text: string;
  context?: string;
  language?: string;
  domain?: string;
  category?: string;
  options?: LexicalQueryOptions;
}
