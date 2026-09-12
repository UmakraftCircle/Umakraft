import { DictionaryEntry } from './dictionary-entry.js';

export enum DictionaryConfidenceLevel {
  CURATED = 1.00,
  VERIFIED = 0.90,
  CANDIDATE = 0.70,
  UNTRUSTED = 0.50
}

export type ConfidenceClassification = 'curated' | 'verified' | 'candidate' | 'untrusted';

export class DictionaryConfidenceEngine {
  /**
   * Classifies a numerical confidence score into standard category.
   * 1.00 = Curated
   * 0.90 = Verified
   * 0.70 = Candidate
   * Below 0.70 = Untrusted
   */
  public static getLevel(confidence: number): ConfidenceClassification {
    if (confidence >= 1.00) return 'curated';
    if (confidence >= 0.85) return 'verified';
    if (confidence >= 0.70) return 'candidate';
    return 'untrusted';
  }

  /**
   * Checks if confidence meets the minimum trust threshold (>= 0.70).
   */
  public static isTrusted(confidence: number): boolean {
    return confidence >= 0.70;
  }

  /**
   * Computes a confidence score based on definition completeness, examples, and source.
   */
  public static scoreEntry(entry: Partial<DictionaryEntry>): number {
    if (entry.confidence !== undefined && entry.confidence >= 0 && entry.confidence <= 1) {
      return entry.confidence;
    }
    if (!entry.definitions || entry.definitions.length === 0) {
      return DictionaryConfidenceLevel.UNTRUSTED;
    }
    if (entry.definitions.length > 0 && entry.examples && entry.examples.length > 0) {
      return DictionaryConfidenceLevel.CURATED;
    }
    if (entry.definitions.length > 0) {
      return DictionaryConfidenceLevel.VERIFIED;
    }
    return DictionaryConfidenceLevel.CANDIDATE;
  }
}
