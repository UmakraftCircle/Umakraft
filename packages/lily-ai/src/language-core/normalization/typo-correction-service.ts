import { FuzzyMatcher } from './fuzzy-matcher.js';
import { CorrectionScorer, CorrectionConfidence } from './correction-scorer.js';
import { AliasService } from './alias-service.js';
import { DictionaryService } from '../dictionary-service.js';

export interface CorrectionResult {
  original: string;
  corrected: string;
  confidence: CorrectionConfidence;
  source: string;
}

export class TypoCorrectionService {
  private fuzzyMatcher = new FuzzyMatcher();
  private scorer = new CorrectionScorer();
  private aliasService = new AliasService();
  private dictionaryService = new DictionaryService();

  // Known valid candidates (Taxonomy / Glossary / Dictionary terms)
  private candidates = [
    'Kitasan Black',
    'Oguri Cap',
    'Front Runner',
    'Pace Chaser',
    'Late Surger',
    'End Closer',
    'Champions Meeting',
    'League of Heroes',
    'Speed',
    'Stamina',
    'Power',
    'Guts',
    'Wisdom'
  ];

  /**
   * Pre-cleans common OCR errors before doing fuzzy matching
   */
  public cleanOCRErrors(text: string): string {
    return text
      .replace(/Fr0nt/g, 'Front')
      .replace(/B1ack/g, 'Black')
      .replace(/C@p/g, 'Cap')
      .replace(/5peed/g, 'Speed')
      .replace(/0guri/g, 'Oguri');
  }

  /**
   * Evaluates if correction is ambiguous (e.g. 'speed')
   */
  public isAmbiguous(text: string): boolean {
    const lower = text.toLowerCase().trim();
    // 'speed' could mean Speed Stat, Speed Support, or Speed Factor - needs clarification
    if (lower === 'speed' || lower === 'spd') {
      return true;
    }
    return false;
  }

  /**
   * Corrects a single term or name
   */
  public correct(text: string): CorrectionResult {
    const ocrCleaned = this.cleanOCRErrors(text);
    const resolvedAlias = this.aliasService.resolve(ocrCleaned);

    if (resolvedAlias) {
      return {
        original: text,
        corrected: resolvedAlias,
        confidence: CorrectionConfidence.HIGH,
        source: 'alias'
      };
    }

    // Direct dictionary check to prevent overcorrecting valid general vocabulary words
    if (this.dictionaryService.hasWord(ocrCleaned)) {
      return {
        original: text,
        corrected: text,
        confidence: CorrectionConfidence.HIGH,
        source: 'none'
      };
    }

    // Fuzzy match against taxonomy/glossary candidates
    const matches = this.fuzzyMatcher.match(ocrCleaned, this.candidates);
    const bestMatch = matches[0];

    if (bestMatch && bestMatch.similarity >= 0.6) {
      const confidence = this.scorer.scoreConfidence(bestMatch.similarity, bestMatch.distance);
      return {
        original: text,
        corrected: bestMatch.candidate,
        confidence,
        source: 'fuzzy'
      };
    }

    return {
      original: text,
      corrected: text,
      confidence: CorrectionConfidence.HIGH,
      source: 'none'
    };
  }
}
