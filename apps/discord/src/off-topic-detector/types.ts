/**
 * OffTopicDetector — shared type contracts.
 *
 * Scope: this file defines ONLY the detector's public API. It does not modify
 * the umamusume domain package, guard.ts safety logic, or any other module.
 */

/** Binary verdict exposed to the caller. There is no third output state. */
export type OffTopicVerdict = 'IN_SCOPE' | 'OFF_TOPIC';

/** How the verdict was reached. */
export type ResolutionMethod = 'taxonomy' | 'search';

/** Confidence of the verdict. */
export type Confidence = 'high' | 'low';

/**
 * The single result contract. Binary verdict + orthogonal confidence + method.
 */
export interface TopicVerdict {
  verdict: OffTopicVerdict;
  confidence: Confidence;
  method: ResolutionMethod;
}

/** One row of the tiered taxonomy (mirrors the .table schema). */
export interface TaxonomyTerm {
  id: number;
  term: string;
  tier: 'strong' | 'weak';
  category?: string;
  note?: string;
}

/** Minimal shape required from the umamusume_search tool for escalation. */
export interface SearchValidationResult {
  success: boolean;
  excerpts?: { text?: string }[] | null;
}

/** Signature the detector uses to call the search escalation. */
export type SearchEscalator = (query: string) => Promise<SearchValidationResult>;
