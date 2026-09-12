import { SynonymRegistry } from './synonym-registry.js';
import { SynonymNormalizer } from './synonym-normalizer.js';
import { SynonymLookupResult, SynonymRelation, SynonymLookupOptions } from './synonym-entry.js';
import { SynonymConfidenceEngine } from './synonym-confidence.js';

export class SynonymResolver {
  private registry: SynonymRegistry;

  constructor(registry: SynonymRegistry) {
    this.registry = registry;
  }

  /**
   * Resolves synonyms for a given word using exact match and morphological lemmatization.
   */
  public resolve(word: string, options?: SynonymLookupOptions | string): SynonymLookupResult {
    const opts: SynonymLookupOptions = typeof options === 'string'
      ? { context: options }
      : (options || {});

    const norm = SynonymNormalizer.normalize(word);
    const minConf = opts.minConfidence ?? 0.50;

    // 1. Try exact normalized lookup
    let entry = this.registry.get(norm.normalized, opts.context);
    let targetWord = norm.normalized;

    // 2. If not found, try base lemma (e.g. running -> run, faster -> fast)
    if (!entry && norm.lemma !== norm.normalized) {
      entry = this.registry.get(norm.lemma, opts.context);
      if (entry) {
        targetWord = norm.lemma;
      }
    }

    if (!entry) {
      // Check if word appears as a synonym in reverse index
      const synonyms = this.registry.getSynonyms(targetWord, opts.context, minConf);
      if (synonyms.length > 0) {
        return {
          found: true,
          word: targetWord,
          synonyms: opts.limit ? synonyms.slice(0, opts.limit) : synonyms,
          relations: synonyms.map(s => ({
            synonym: s,
            confidence: 0.90,
            context: opts.context
          })),
          confidence: 0.90,
          context: opts.context
        };
      }

      return {
        found: false,
        word: (word || '').trim(),
        synonyms: [],
        relations: [],
        confidence: 0,
        context: opts.context
      };
    }

    // Collect and filter relations
    const relations: SynonymRelation[] = [];
    const synonymsSet = new Set<string>();

    if (entry.relations && entry.relations.length > 0) {
      for (const rel of entry.relations) {
        const conf = SynonymConfidenceEngine.calculateConfidence(
          rel.confidence,
          rel.context,
          opts.context
        );
        if (conf >= minConf) {
          relations.push({
            ...rel,
            confidence: conf
          });
          synonymsSet.add(rel.synonym);
        }
      }
    } else {
      for (const syn of entry.synonyms) {
        relations.push({
          synonym: syn,
          confidence: entry.confidence,
          context: entry.context,
          partOfSpeech: entry.partOfSpeech
        });
        synonymsSet.add(syn);
      }
    }

    // Sort by confidence descending
    relations.sort((a, b) => b.confidence - a.confidence);

    let synonymsList = Array.from(synonymsSet);
    if (opts.limit && opts.limit > 0) {
      synonymsList = synonymsList.slice(0, opts.limit);
    }

    return {
      found: synonymsList.length > 0,
      word: entry.word,
      synonyms: synonymsList,
      relations: opts.limit ? relations.slice(0, opts.limit) : relations,
      confidence: entry.confidence,
      context: entry.context
    };
  }
}
