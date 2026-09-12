import { AntonymEntry, AntonymRelation } from './antonym-entry.js';
import { AntonymConfidenceEngine } from './antonym-confidence.js';

export class AntonymRegistry {
  // Map of normalized_word -> array of AntonymEntry (grouped by context/pos)
  private entriesByWord = new Map<string, AntonymEntry[]>();
  // Reverse index for fast bidirectional lookup
  private reverseIndex = new Map<string, Set<string>>();

  /**
   * Registers an antonym entry and automatically establishes bidirectional links.
   * F16.3: win -> lose automatically creates lose -> win
   */
  public register(entry: AntonymEntry): void {
    const wordKey = entry.word.trim().toLowerCase();
    const existingList = this.entriesByWord.get(wordKey) || [];

    // Normalize antonyms list
    const cleanAntonyms = entry.antonyms
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0 && s !== wordKey);

    // Build relations if not provided
    const relations: AntonymRelation[] = entry.relations || cleanAntonyms.map(ant => ({
      antonym: ant,
      confidence: entry.confidence,
      context: entry.context,
      partOfSpeech: entry.partOfSpeech
    }));

    const normalizedEntry: AntonymEntry = {
      word: wordKey,
      antonyms: Array.from(new Set(cleanAntonyms)),
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

    // F16.3 Bidirectional Link Generation
    for (const ant of cleanAntonyms) {
      // Reverse index
      if (!this.reverseIndex.has(ant)) {
        this.reverseIndex.set(ant, new Set());
      }
      this.reverseIndex.get(ant)!.add(wordKey);

      // Create inverse entry in entriesByWord if not directly present
      const antEntries = this.entriesByWord.get(ant) || [];
      const inverseMatch = antEntries.find(
        e => (e.context || '').toLowerCase() === (entry.context || '').toLowerCase()
      );

      if (inverseMatch) {
        if (!inverseMatch.antonyms.includes(wordKey)) {
          inverseMatch.antonyms.push(wordKey);
          if (inverseMatch.relations) {
            inverseMatch.relations.push({
              antonym: wordKey,
              confidence: entry.confidence,
              context: entry.context,
              partOfSpeech: entry.partOfSpeech
            });
          }
        }
      } else {
        antEntries.push({
          word: ant,
          antonyms: [wordKey],
          confidence: entry.confidence,
          context: entry.context,
          partOfSpeech: entry.partOfSpeech,
          relations: [{
            antonym: wordKey,
            confidence: entry.confidence,
            context: entry.context,
            partOfSpeech: entry.partOfSpeech
          }]
        });
        this.entriesByWord.set(ant, antEntries);
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
      antonyms: [wordB],
      confidence,
      context,
      partOfSpeech
    });
  }

  /**
   * Retrieves an entry matching word and optional context.
   */
  public get(word: string, context?: string): AntonymEntry | undefined {
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
  public getAll(word: string): AntonymEntry[] {
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
   * Returns a flat list of antonyms for a word, filtered by confidence and context.
   */
  public getAntonyms(word: string, context?: string, minConfidence = 0.50): string[] {
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
          const conf = AntonymConfidenceEngine.calculateConfidence(rel.confidence, rel.context, context);
          if (conf >= minConfidence) {
            result.add(rel.antonym);
          }
        }
      } else {
        if (entry.confidence >= minConfidence) {
          for (const s of entry.antonyms) {
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
   * Checks if wordA and wordB are antonyms of each other.
   */
  public areOpposites(wordA: string, wordB: string, context?: string, minConfidence = 0.50): boolean {
    const normA = (wordA || '').trim().toLowerCase();
    const normB = (wordB || '').trim().toLowerCase();
    if (!normA || !normB || normA === normB) return false;

    const antonymsA = this.getAntonyms(normA, context, minConfidence);
    if (antonymsA.includes(normB)) return true;

    const antonymsB = this.getAntonyms(normB, context, minConfidence);
    return antonymsB.includes(normA);
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
  public entries(): AntonymEntry[] {
    const all: AntonymEntry[] = [];
    for (const list of this.entriesByWord.values()) {
      all.push(...list);
    }
    return all;
  }
}
