export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'interjection'
  | 'phrase'
  | 'abbreviation'
  | string;

export interface VocabularyEntry {
  word: string;
  definition: string;
  partOfSpeech: PartOfSpeech;
  language: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
}

export class VocabularyRegistry {
  private entries = new Map<string, VocabularyEntry>();
  private allEntries: VocabularyEntry[] = [];
  private posIndex = new Map<string, VocabularyEntry[]>();

  public register(entry: VocabularyEntry): void {
    const key = (entry.word || '').trim().toLowerCase();
    this.allEntries.push(entry);
    if (key) {
      this.entries.set(key, entry);
    }

    const pos = (entry.partOfSpeech || '').trim().toLowerCase();
    if (pos) {
      const list = this.posIndex.get(pos) || [];
      list.push(entry);
      this.posIndex.set(pos, list);
    }
  }

  public get(word: string): VocabularyEntry | undefined {
    return this.entries.get(word.trim().toLowerCase());
  }

  public has(word: string): boolean {
    return this.entries.has(word.trim().toLowerCase());
  }

  public getAll(): VocabularyEntry[] {
    return [...this.allEntries];
  }

  public getByPartOfSpeech(pos: string): VocabularyEntry[] {
    const key = pos.trim().toLowerCase();
    return this.posIndex.get(key) || [];
  }

  public count(): number {
    return this.allEntries.length;
  }

  public clear(): void {
    this.entries.clear();
    this.allEntries = [];
    this.posIndex.clear();
  }
}
