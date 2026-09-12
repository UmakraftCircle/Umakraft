import { AntonymRegistry } from './antonym-registry.js';
import { AntonymNormalizer } from './antonym-normalizer.js';
import { AntonymLookupResult, AntonymRelation, AntonymLookupOptions } from './antonym-entry.js';
import { AntonymConfidenceEngine } from './antonym-confidence.js';

export class AntonymResolver {
  private registry: AntonymRegistry;

  constructor(registry: AntonymRegistry) {
    this.registry = registry;
  }

  /**
   * Resolves antonyms for a given word using exact match and morphological lemmatization.
   */
  public resolve(word: string, options?: AntonymLookupOptions | string): AntonymLookupResult {
    const opts: AntonymLookupOptions = typeof options === 'string'
      ? { context: options }
      : (options || {});

    const norm = AntonymNormalizer.normalize(word);
    const minConf = opts.minConfidence ?? 0.50;

    // 1. Try exact normalized lookup
    let entry = this.registry.get(norm.normalized, opts.context);
    let targetWord = norm.normalized;

    // 2. If not found, try base lemma (e.g. increasing -> increase, faster -> fast, unmet -> met)
    if (!entry && norm.lemma !== norm.normalized) {
      entry = this.registry.get(norm.lemma, opts.context);
      if (entry) {
        targetWord = norm.lemma;
      }
    }

    if (!entry) {
      // Check if word appears as an antonym in reverse index
      const antonyms = this.registry.getAntonyms(targetWord, opts.context, minConf);
      if (antonyms.length > 0) {
        return {
          found: true,
          word: targetWord,
          antonyms: opts.limit ? antonyms.slice(0, opts.limit) : antonyms,
          relations: antonyms.map(a => ({
            antonym: a,
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
        antonyms: [],
        relations: [],
        confidence: 0,
        context: opts.context
      };
    }

    // Collect and filter relations
    const relations: AntonymRelation[] = [];
    const antonymsSet = new Set<string>();

    if (entry.relations && entry.relations.length > 0) {
      for (const rel of entry.relations) {
        const conf = AntonymConfidenceEngine.calculateConfidence(
          rel.confidence,
          rel.context,
          opts.context
        );
        if (conf >= minConf) {
          relations.push({
            ...rel,
            confidence: conf
          });
          antonymsSet.add(rel.antonym);
        }
      }
    } else {
      for (const ant of entry.antonyms) {
        relations.push({
          antonym: ant,
          confidence: entry.confidence,
          context: entry.context,
          partOfSpeech: entry.partOfSpeech
        });
        antonymsSet.add(ant);
      }
    }

    // Sort by confidence descending
    relations.sort((a, b) => b.confidence - a.confidence);

    let antonymsList = Array.from(antonymsSet);
    if (opts.limit && opts.limit > 0) {
      antonymsList = antonymsList.slice(0, opts.limit);
    }

    const topConfidence = relations.length > 0 ? relations[0].confidence : entry.confidence;

    return {
      found: antonymsList.length > 0,
      word: entry.word,
      antonyms: antonymsList,
      relations,
      confidence: topConfidence,
      context: entry.context || opts.context
    };
  }
}
