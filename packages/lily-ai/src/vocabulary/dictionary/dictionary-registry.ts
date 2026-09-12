import { DictionaryEntry } from './dictionary-entry.js';
import { DictionaryNormalizer } from './dictionary-normalizer.js';

export class DictionaryRegistry {
  private entries = new Map<string, DictionaryEntry>();
  private aliasMap = new Map<string, string>(); // alias -> canonical word
  private normalizedMap = new Map<string, string>(); // normalizedWord -> canonical word
  private partOfSpeechMap = new Map<string, Set<string>>(); // pos -> Set of canonical words

  /**
   * Registers a dictionary entry into the registry.
   */
  public register(entry: DictionaryEntry): void {
    if (!entry || !entry.word) return;

    const key = entry.word.trim().toLowerCase();
    if (!key) return;

    // Ensure normalizedWord is set
    const normalizedWord = entry.normalizedWord
      ? entry.normalizedWord.trim().toLowerCase()
      : DictionaryNormalizer.normalize(entry.word).normalized;

    const cleanEntry: DictionaryEntry = {
      word: entry.word.trim(),
      normalizedWord,
      partOfSpeech: entry.partOfSpeech ? entry.partOfSpeech.trim().toLowerCase() : 'noun',
      definitions: Array.isArray(entry.definitions)
        ? entry.definitions.map(d => d.trim()).filter(Boolean)
        : [],
      examples: Array.isArray(entry.examples)
        ? entry.examples.map(e => e.trim()).filter(Boolean)
        : [],
      aliases: Array.isArray(entry.aliases)
        ? entry.aliases.map(a => a.trim().toLowerCase()).filter(Boolean)
        : [],
      confidence: typeof entry.confidence === 'number' ? entry.confidence : 1.00
    };

    this.entries.set(key, cleanEntry);
    this.normalizedMap.set(normalizedWord, key);

    // Index aliases
    if (cleanEntry.aliases) {
      for (const alias of cleanEntry.aliases) {
        this.aliasMap.set(alias.toLowerCase(), key);
      }
    }

    // Index Part of Speech
    const pos = cleanEntry.partOfSpeech;
    if (!this.partOfSpeechMap.has(pos)) {
      this.partOfSpeechMap.set(pos, new Set());
    }
    this.partOfSpeechMap.get(pos)!.add(key);
  }

  /**
   * Retrieves a dictionary entry by exact word, normalized form, or alias.
   */
  public get(word: string): DictionaryEntry | undefined {
    if (!word) return undefined;
    const clean = word.trim().toLowerCase();
    if (!clean) return undefined;

    // 1. Direct match
    if (this.entries.has(clean)) {
      return this.entries.get(clean);
    }

    // 2. Normalized lemma match
    if (this.normalizedMap.has(clean)) {
      const canonical = this.normalizedMap.get(clean)!;
      return this.entries.get(canonical);
    }

    // 3. Alias match
    if (this.aliasMap.has(clean)) {
      const canonical = this.aliasMap.get(clean)!;
      return this.entries.get(canonical);
    }

    // 4. Morphological resolution of lookup word
    const resolved = DictionaryNormalizer.normalize(clean);
    if (resolved.normalized && resolved.normalized !== clean) {
      if (this.entries.has(resolved.normalized)) {
        return this.entries.get(resolved.normalized);
      }
      if (this.normalizedMap.has(resolved.normalized)) {
        const canonical = this.normalizedMap.get(resolved.normalized)!;
        return this.entries.get(canonical);
      }
    }

    return undefined;
  }

  /**
   * Checks if an entry exists for the given word or morphological form.
   */
  public has(word: string): boolean {
    return this.get(word) !== undefined;
  }

  /**
   * Returns all dictionary entries.
   */
  public getAll(): DictionaryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Returns all dictionary entries matching a part of speech.
   */
  public getByPartOfSpeech(pos: string): DictionaryEntry[] {
    if (!pos) return [];
    const cleanPos = pos.trim().toLowerCase();
    const wordKeys = this.partOfSpeechMap.get(cleanPos);
    if (!wordKeys) return [];

    const results: DictionaryEntry[] = [];
    for (const key of wordKeys) {
      const entry = this.entries.get(key);
      if (entry) results.push(entry);
    }
    return results;
  }

  /**
   * Total count of unique dictionary entries.
   */
  public count(): number {
    return this.entries.size;
  }

  /**
   * Clears all stored dictionary entries.
   */
  public clear(): void {
    this.entries.clear();
    this.aliasMap.clear();
    this.normalizedMap.clear();
    this.partOfSpeechMap.clear();
  }
}
