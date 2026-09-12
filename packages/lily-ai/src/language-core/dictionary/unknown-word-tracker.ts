import { VocabularyCategory } from './vocabulary-categories.js';

export interface UnknownWordRecord {
  word: string;
  count: number;
  lastSeen: Date;
}

export class UnknownWordTracker {
  private records = new Map<string, UnknownWordRecord>();

  /**
   * Tracks an unknown word, incrementing its usage count.
   */
  public track(word: string): void {
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return;

    const record = this.records.get(cleanWord);
    if (record) {
      record.count += 1;
      record.lastSeen = new Date();
    } else {
      this.records.set(cleanWord, {
        word: cleanWord,
        count: 1,
        lastSeen: new Date()
      });
    }
  }

  /**
   * Retrieves all recorded unknown words sorted by frequency.
   */
  public getRecords(): UnknownWordRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Clears tracked records.
   */
  public clear(): void {
    this.records.clear();
  }

  /**
   * Checks if a word is tracked.
   */
  public getRecord(word: string): UnknownWordRecord | undefined {
    return this.records.get(word.toLowerCase().trim());
  }
}
