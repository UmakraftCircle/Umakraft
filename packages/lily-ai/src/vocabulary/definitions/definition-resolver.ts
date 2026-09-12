import {
  Definition,
  DefinitionLookupOptions,
  DefinitionLookupResult,
  DefinitionRankedItem
} from './definition-source.js';
import { DefinitionRegistry } from './definition-registry.js';
import { DefinitionConfidenceEngine } from './definition-confidence.js';

export class DefinitionResolver {
  private registry: DefinitionRegistry;

  constructor(registry: DefinitionRegistry) {
    this.registry = registry;
  }

  /**
   * Resolves a word to its best definition, ranking multiple candidates when polysemous.
   */
  public resolve(
    word: string,
    options?: DefinitionLookupOptions | string
  ): DefinitionLookupResult {
    const opts: DefinitionLookupOptions = typeof options === 'string'
      ? { context: options }
      : options || {};

    const rawWord = word.trim();
    if (!rawWord) {
      return {
        found: false,
        word: rawWord,
        definitions: [],
        source: 'none',
        confidence: 0
      };
    }

    // 1. Fetch all definitions from registry
    const canonical = this.registry.resolveCanonical(rawWord);
    let allDefs = this.registry.getAll(canonical);

    // Fallback: If no direct match, check for morphological variants or stem
    if (allDefs.length === 0) {
      if (canonical.endsWith('s') && this.registry.has(canonical.slice(0, -1))) {
        allDefs = this.registry.getAll(canonical.slice(0, -1));
      } else if (canonical.endsWith('ing') && this.registry.has(canonical.slice(0, -3))) {
        allDefs = this.registry.getAll(canonical.slice(0, -3));
      } else if (canonical.endsWith('ed') && this.registry.has(canonical.slice(0, -2))) {
        allDefs = this.registry.getAll(canonical.slice(0, -2));
      }
    }

    if (allDefs.length === 0) {
      return {
        found: false,
        word: rawWord,
        definitions: [],
        source: 'none',
        confidence: 0
      };
    }

    // 2. Filter by minimum confidence or source if requested
    let filtered = allDefs;
    if (opts.minConfidence !== undefined) {
      filtered = filtered.filter(d => d.confidence >= opts.minConfidence!);
    }
    if (opts.source) {
      const srcLower = opts.source.toLowerCase();
      filtered = filtered.filter(d => d.source.toLowerCase() === srcLower);
    }
    if (filtered.length === 0) {
      filtered = allDefs; // fallback
    }

    // 3. Rank definitions based on context, query, taxonomy, and authority
    const ranked = this.rankDefinitions(filtered, opts);
    const top = ranked[0];

    const finalConfidence = DefinitionConfidenceEngine.calculateConfidence(top.definition, {
      context: opts.context,
      taxonomy: opts.taxonomy,
      query: opts.query,
      partOfSpeech: opts.partOfSpeech
    });

    return {
      found: true,
      word: top.definition.word,
      selectedDefinition: top.definition,
      definitions: ranked.map(r => r.definition),
      bestDefinition: top.definition.definition,
      source: top.definition.source,
      confidence: finalConfidence,
      rankingReasons: top.reasons
    };
  }

  /**
   * Ranks an array of definitions for a word based on contextual relevance and source authority.
   */
  public rankDefinitions(
    definitions: Definition[],
    options?: DefinitionLookupOptions
  ): DefinitionRankedItem[] {
    const scored: DefinitionRankedItem[] = [];

    const targetCtx = options?.context?.toLowerCase();
    const query = options?.query?.toLowerCase();
    const taxonomy = options?.taxonomy?.map(t => t.toLowerCase()) || [];
    const glossary = options?.glossary?.map(g => g.toLowerCase()) || [];
    const targetPos = options?.partOfSpeech?.toLowerCase();

    for (const def of definitions) {
      let score = 0;
      const reasons: string[] = [];

      // 1. Base Authority (Curated: 100, Wiktionary: 85, WordNet: 75, Learned: 50)
      score += def.authority;
      reasons.push(`Base authority: ${def.authority}`);

      // 2. Base Confidence
      score += def.confidence * 20;

      // 3. Context Matching (+40 for exact context match, -30 for domain mismatch)
      const defCtx = (def.context || 'general').toLowerCase();
      if (targetCtx) {
        if (defCtx === targetCtx || (def.tags && def.tags.some(t => t.toLowerCase() === targetCtx))) {
          score += 40;
          reasons.push(`Exact context match: '${targetCtx}'`);
        } else if (defCtx !== 'general' && targetCtx !== 'general') {
          score -= 30;
          reasons.push(`Context mismatch: definition is '${defCtx}', query requires '${targetCtx}'`);
        }
      }

      // 4. Query Analysis (e.g. query "race strategy" matches tags 'strategy', 'racing', etc.)
      if (query) {
        const qTokens = query.split(/\s+/).filter(t => t.length > 2);
        let queryMatches = 0;

        for (const token of qTokens) {
          if (defCtx.includes(token)) queryMatches += 2;
          if (def.definition.toLowerCase().includes(token)) queryMatches += 1;
          if (def.tags && def.tags.some(t => t.toLowerCase().includes(token))) queryMatches += 2;
          if (def.examples && def.examples.some(e => e.toLowerCase().includes(token))) queryMatches += 1;
        }

        if (queryMatches > 0) {
          const queryBonus = Math.min(35, queryMatches * 8);
          score += queryBonus;
          reasons.push(`Query semantic alignment (+${queryBonus})`);
        }
      }

      // 5. Taxonomy & Glossary Alignment
      if (taxonomy.length > 0 && def.tags) {
        const taxMatches = taxonomy.filter(tax => def.tags?.some(t => t.toLowerCase().includes(tax)));
        if (taxMatches.length > 0) {
          score += 20;
          reasons.push(`Taxonomy alignment: ${taxMatches.join(', ')}`);
        }
      }

      if (glossary.length > 0 && def.tags) {
        const glossMatches = glossary.filter(g => def.tags?.some(t => t.toLowerCase().includes(g)));
        if (glossMatches.length > 0) {
          score += 15;
          reasons.push(`Glossary alignment: ${glossMatches.join(', ')}`);
        }
      }

      // 6. Part of Speech Alignment
      if (targetPos && def.partOfSpeech) {
        if (def.partOfSpeech.toLowerCase() === targetPos) {
          score += 10;
          reasons.push(`Part of speech match: '${targetPos}'`);
        } else {
          score -= 15;
          reasons.push(`Part of speech mismatch: '${def.partOfSpeech}' vs '${targetPos}'`);
        }
      }

      // 7. Richness bonus (examples & synonyms)
      if (def.examples && def.examples.length > 0) score += 3;
      if (def.synonyms && def.synonyms.length > 0) score += 2;

      scored.push({
        definition: def,
        score: Number(score.toFixed(2)),
        reasons
      });
    }

    // Sort descending by calculated score
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }
}
