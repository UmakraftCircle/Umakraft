/**
 * taxonomyLoader.ts — provides the tiered taxonomy to OffTopicDetector.
 *
 * The taxonomy is shipped as a generated TypeScript module (`taxonomy.ts`)
 * rather than a runtime `.table` fetch, so the deployed bot has zero network
 * dependency for a local match. Regenerate `taxonomy.ts` from the uma.guide
 * data via the daily sync job.
 */

import type { TaxonomyTerm } from './types.js';
import { taxonomyTerms } from './taxonomy.js';

/**
 * Return the full tiered taxonomy. Loads once and reuses the in-memory array
 * (cheap — a strong match resolves in microseconds with zero network calls).
 */
export function toTaxonomyTerms(): TaxonomyTerm[] {
  return taxonomyTerms;
}
