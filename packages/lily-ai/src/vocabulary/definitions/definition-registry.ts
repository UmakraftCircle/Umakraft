import { Definition } from './definition-source.js';
import { DefinitionValidator } from './definition-validator.js';

export class DefinitionRegistry {
  private wordsMap: Map<string, Definition[]> = new Map();
  private aliasMap: Map<string, string> = new Map();

  /**
   * Registers a definition in the repository.
   * If definitions for this word already exist, appends or updates existing context definitions.
   */
  public register(entry: Definition): boolean {
    const validation = DefinitionValidator.validate(entry);
    if (!validation.valid) return false;

    const normalizedWord = entry.word.trim().toLowerCase();
    const existingList = this.wordsMap.get(normalizedWord) || [];

    // Check if duplicate definition exists for this word + context + source
    const existingIndex = existingList.findIndex(d =>
      (d.context || 'general').toLowerCase() === (entry.context || 'general').toLowerCase() &&
      d.source.toLowerCase() === entry.source.toLowerCase()
    );

    if (existingIndex >= 0) {
      existingList[existingIndex] = entry;
    } else {
      existingList.push(entry);
    }

    // Sort by authority (descending), then confidence (descending)
    existingList.sort((a, b) => {
      if (b.authority !== a.authority) {
        return b.authority - a.authority;
      }
      return b.confidence - a.confidence;
    });

    this.wordsMap.set(normalizedWord, existingList);
    return true;
  }

  /**
   * Registers multiple definition entries.
   */
  public registerBatch(entries: Definition[]): number {
    let count = 0;
    for (const entry of entries) {
      if (this.register(entry)) count++;
    }
    return count;
  }

  /**
   * Registers an alias for a word.
   */
  public registerAlias(alias: string, canonicalWord: string): void {
    this.aliasMap.set(alias.trim().toLowerCase(), canonicalWord.trim().toLowerCase());
  }

  /**
   * Resolves a word or alias to canonical form.
   */
  public resolveCanonical(word: string): string {
    const lower = word.trim().toLowerCase();
    return this.aliasMap.get(lower) || lower;
  }

  /**
   * Checks if a word exists in the registry.
   */
  public has(word: string, context?: string): boolean {
    const canonical = this.resolveCanonical(word);
    const list = this.wordsMap.get(canonical);
    if (!list || list.length === 0) return false;
    if (!context) return true;
    return list.some(d => (d.context || 'general').toLowerCase() === context.toLowerCase());
  }

  /**
   * Retrieves all definitions for a given word.
   */
  public getAll(word: string): Definition[] {
    const canonical = this.resolveCanonical(word);
    const list = this.wordsMap.get(canonical);
    return list ? [...list] : [];
  }

  /**
   * Retrieves the highest ranking definition for a given word, optionally matching context.
   */
  public get(word: string, context?: string): Definition | undefined {
    const list = this.getAll(word);
    if (list.length === 0) return undefined;
    if (!context) return list[0];

    const ctxLower = context.toLowerCase();
    const contextMatch = list.find(d =>
      (d.context || '').toLowerCase() === ctxLower ||
      (d.tags && d.tags.some(t => t.toLowerCase() === ctxLower))
    );

    return contextMatch || list[0];
  }

  /**
   * Removes a word or specific context definition.
   */
  public remove(word: string, context?: string): boolean {
    const canonical = this.resolveCanonical(word);
    if (!context) {
      return this.wordsMap.delete(canonical);
    }
    const list = this.wordsMap.get(canonical);
    if (!list) return false;

    const filtered = list.filter(d => (d.context || 'general').toLowerCase() !== context.toLowerCase());
    if (filtered.length === 0) {
      this.wordsMap.delete(canonical);
    } else {
      this.wordsMap.set(canonical, filtered);
    }
    return true;
  }

  /**
   * Returns count of unique words in registry.
   */
  public count(): number {
    return this.wordsMap.size;
  }

  /**
   * Returns total count of all definition entries across all words.
   */
  public totalDefinitions(): number {
    let sum = 0;
    for (const defs of this.wordsMap.values()) {
      sum += defs.length;
    }
    return sum;
  }

  /**
   * Clears all definitions and aliases.
   */
  public clear(): void {
    this.wordsMap.clear();
    this.aliasMap.clear();
  }

  /**
   * Lists all indexed words.
   */
  public getAllWords(): string[] {
    return Array.from(this.wordsMap.keys());
  }

  /**
   * Returns a flat array of all definition records.
   */
  public getAllDefinitions(): Definition[] {
    const result: Definition[] = [];
    for (const defs of this.wordsMap.values()) {
      result.push(...defs);
    }
    return result;
  }

  /**
   * Queries definitions by source.
   */
  public findBySource(source: string): Definition[] {
    const target = source.toLowerCase();
    return this.getAllDefinitions().filter(d => d.source.toLowerCase() === target);
  }

  /**
   * Queries definitions by context.
   */
  public findByContext(context: string): Definition[] {
    const target = context.toLowerCase();
    return this.getAllDefinitions().filter(d =>
      (d.context || '').toLowerCase() === target ||
      (d.tags && d.tags.some(t => t.toLowerCase() === target))
    );
  }
}
