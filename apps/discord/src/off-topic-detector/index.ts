/**
 * Barrel export for the OffTopicDetector module.
 */
export {
  classifyTopic,
  normalize,
  matchTaxonomy,
  isClearlyUnrelated,
  searchConfirmsRelation,
} from './OffTopicDetector.js';
export { toTaxonomyTerms } from './taxonomyLoader.js';
export { buildSearchEscalator } from './searchAdapter.js';
export type {
  OffTopicVerdict,
  ResolutionMethod,
  Confidence,
  TopicVerdict,
  TaxonomyTerm,
  SearchValidationResult,
  SearchEscalator,
} from './types.js';
