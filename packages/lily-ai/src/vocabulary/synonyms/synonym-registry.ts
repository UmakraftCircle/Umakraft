import { SynonymEntry, SynonymRelation } from './synonym-entry.js';
import { SynonymConfidenceEngine } from './synonym-confidence.js';

export class SynonymRegistry {
  // Map of normalized_word -> array of SynonymEntry (grouped by context/pos)
  private entriesByWord = new Map<string, SynonymEntry[]>();
  // Reverse index for fast bidirectional lookup
  private reverseIndex = new Map<string, Set<string>>();

  /**
   * Registers a synonym entry and establishes bidirectional links.
   */
  public register(entry: SynonymEntry): void {
    const wordKey = entry.word.trim().toLowerCase();
    const existingList = this.entriesByWord.get(wordKey) || [];

    // Normalize synonyms list
    const cleanSynonyms = entry.synonyms
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0 && s !== wordKey);

    // Build relations if not provided
    const relations: SynonymRelation[] = entry.relations || cleanSynonyms.map(syn => ({
      synonym: syn,
      confidence: entry.confidence,
      context: entry.context,
      partOfSpeech: entry.partOfSpeech
    }));

    const normalizedEntry: SynonymEntry = {
      word: wordKey,
      synonyms: Array.from(new Set(cleanSynonyms)),
      confidence: entry.confidence,
      context: entry.context,
      partOfSpeech: entry.partOfSpeech,
      relations
    };

    // Replace if exact match on context exists, else append
    const existingIndex = existingList.findIndex(
      e => (e.context || '').toLowerCase() === (entry.context || '').toLowerCase() &&
           (e.partOfSpeech || '') === (entry.partOfSpeech || '')
    );

    if (existingIndex >= 0) {
      existingList[existingIndex] = normalizedEntry;
    } else {
      existingList.push(normalizedEntry);
    }
    this.entriesByWord.set(wordKey, existingList);

    // F15.3 Bidirectional Link Generation
    for (const syn of cleanSynonyms) {
      // Reverse index
      if (!this.reverseIndex.has(syn)) {
        this.reverseIndex.set(syn, new Set());
      }
      this.reverseIndex.get(syn)!.add(wordKey);

      // Create inverse entry in reverse map if not directly present
      const synEntries = this.entriesByWord.get(syn) || [];
      const inverseMatch = synEntries.find(
        e => (e.context || '').toLowerCase() === (entry.context || '').toLowerCase()
      );

      if (inverseMatch) {
        if (!inverseMatch.synonyms.includes(wordKey)) {
          inverseMatch.synonyms.push(wordKey);
          if (inverseMatch.relations) {
            inverseMatch.relations.push({
              synonym: wordKey,
              confidence: entry.confidence,
              context: entry.context,
              partOfSpeech: entry.partOfSpeech
            });
          }
        }
      } else {
        synEntries.push({
          word: syn,
          synonyms: [wordKey],
          confidence: entry.confidence,
          context: entry.context,
          partOfSpeech: entry.partOfSpeech,
          relations: [{
            synonym: wordKey,
            confidence: entry.confidence,
            context: entry.context,
            partOfSpeech: entry.partOfSpeech
          }]
        });
        this.entriesByWord.set(syn, synEntries);
      }
    }
  }

  /**
   * Directly registers a bidirectional relation pair.
   */
  public registerBidirectional(
    wordA: string,
    wordB: string,
    confidence = 1.0,
    context?: string,
    partOfSpeech?: string
  ): void {
    this.register({
      word: wordA,
      synonyms: [wordB],
      confidence,
      context,
      partOfSpeech
    });
  }

  /**
   * Retrieves an entry matching word and optional context.
   */
  public get(word: string, context?: string): SynonymEntry | undefined {
    const wordKey = (word || '').trim().toLowerCase();
    const list = this.entriesByWord.get(wordKey);
    if (!list || list.length === 0) return undefined;

    if (!context) {
      return list[0];
    }

    const normContext = context.trim().toLowerCase();
    return list.find(e => (e.context || '').toLowerCase() === normContext) || list[0];
  }

  /**
   * Retrieves all entries for a word across all contexts.
   */
  public getAll(word: string): SynonymEntry[] {
    const wordKey = (word || '').trim().toLowerCase();
    return this.entriesByWord.get(wordKey) || [];
  }

  /**
   * Checks if word exists in registry.
   */
  public has(word: string, context?: string): boolean {
    return this.get(word, context) !== undefined;
  }

  /**
   * Returns a flat list of synonyms for a word, filtered by confidence and context.
   */
  public getSynonyms(word: string, context?: string, minConfidence = 0.50): string[] {
    const wordKey = (word || '').trim().toLowerCase();
    const list = this.entriesByWord.get(wordKey);
    if (!list || list.length === 0) return [];

    const result = new Set<string>();

    for (const entry of list) {
      if (context && entry.context) {
        if (entry.context.toLowerCase() !== context.toLowerCase()) {
          continue;
        }
      }

      if (entry.relations && entry.relations.length > 0) {
        for (const rel of entry.relations) {
          const conf = SynonymConfidenceEngine.calculateConfidence(rel.confidence, rel.context, context);
          if (conf >= minConfidence) {
            result.add(rel.synonym);
          }
        }
      } else {
        if (entry.confidence >= minConfidence) {
          for (const s of entry.synonyms) {
            result.add(s);
          }
        }
      }
    }

    // Also include any reverse mappings that passed confidence
    const reverseSources = this.reverseIndex.get(wordKey);
    if (reverseSources) {
      for (const rev of reverseSources) {
        result.add(rev);
      }
    }

    result.delete(wordKey);
    return Array.from(result);
  }

  /**
   * Returns total count of distinct words indexed.
   */
  public count(): number {
    return this.entriesByWord.size;
  }

  /**
   * Clears registry.
   */
  public clear(): void {
    this.entriesByWord.clear();
    this.reverseIndex.clear();
  }

  /**
   * Returns all entries.
   */
  public entries(): SynonymEntry[] {
    const all: SynonymEntry[] = [];
    for (const list of this.entriesByWord.values()) {
      all.push(...list);
    }
    return all;
  }
}
