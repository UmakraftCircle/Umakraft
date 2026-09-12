import { TypoCorrectionService, CorrectionResult } from './typo-correction-service.js';
import { LanguageCache } from './language-cache.js';
import { CorrectionConfidence } from './correction-scorer.js';
import { AliasService } from './alias-service.js';
import { FuzzyMatcher } from './fuzzy-matcher.js';
import { DictionaryService } from '../dictionary-service.js';

export interface NormalizationResult {
  originalText: string;
  normalizedText: string;
  corrections: CorrectionResult[];
  needsClarification?: boolean;
}

export class NormalizationEngine {
  private correctionService = new TypoCorrectionService();
  private aliasService = new AliasService();
  private fuzzyMatcher = new FuzzyMatcher();
  private dictionaryService = new DictionaryService();
  private cache = new LanguageCache();

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
   * Run multi-pass normalization pipeline on raw text
   */
  public normalize(text: string): NormalizationResult {
    const originalText = text;

    if (this.correctionService.isAmbiguous(text)) {
      return {
        originalText,
        normalizedText: text,
        corrections: [],
        needsClarification: true
      };
    }

    // Check cache
    const cached = this.cache.get(text);
    if (cached) {
      return {
        originalText,
        normalizedText: cached.result,
        corrections: [{
          original: text,
          corrected: cached.result,
          confidence: CorrectionConfidence.HIGH,
          source: 'cache'
        }]
      };
    }

    // Step 1: OCR Cleanup & Whitespace cleanup
    let normalized = this.correctionService.cleanOCRErrors(text);

    // Step 2: Alias Resolution (using boundaries to avoid partial word match)
    const corrections: CorrectionResult[] = [];
    for (const alias of this.aliasService.getAllAliases()) {
      const canonical = this.aliasService.resolve(alias)!;
      const regex = new RegExp(`\\b${alias}\\b`, 'gi');
      if (regex.test(normalized)) {
        normalized = normalized.replace(regex, canonical);
        corrections.push({
          original: alias,
          corrected: canonical,
          confidence: CorrectionConfidence.HIGH,
          source: 'alias'
        });
      }
    }

    // Step 3: Fuzzy sliding window matching
    // Let's split current normalized text into words
    const words = normalized.split(/\s+/);
    
    // We try to find sliding window matches for sizes 3, 2, 1
    const appliedIndices = new Set<number>();

    for (let size = 3; size >= 1; size--) {
      for (let i = 0; i <= words.length - size; i++) {
        // Check if any index in this window is already replaced
        let overlap = false;
        for (let k = 0; k < size; k++) {
          if (appliedIndices.has(i + k)) overlap = true;
        }
        if (overlap) continue;

        const windowWords = words.slice(i, i + size);
        const windowText = windowWords.join(' ').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');

        if (windowText.length < 3) continue;

        // Skip if windowText is a valid dictionary/common word
        if (this.dictionaryService.hasWord(windowText)) continue;

        const matches = this.fuzzyMatcher.match(windowText, this.candidates);
        const best = matches[0];

        if (best && best.similarity >= 0.75 && best.distance > 0) {
          // Guard: if any smaller sub-window of size < current size already exactly matches the candidate,
          // then the larger window should not be corrected to it (since it already contains it exactly).
          let hasExactSubMatch = false;
          if (size > 1) {
            for (let subSize = 1; subSize < size; subSize++) {
              for (let start = 0; start <= size - subSize; start++) {
                const subText = windowWords.slice(start, start + subSize).join(' ').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').toLowerCase().trim();
                if (subText === best.candidate.toLowerCase().trim()) {
                  hasExactSubMatch = true;
                  break;
                }
              }
              if (hasExactSubMatch) break;
            }
          }
          if (hasExactSubMatch) continue;

          // Verify we aren't overcorrecting normal dictionary parts
          const confidence = best.similarity >= 0.85 ? CorrectionConfidence.HIGH : CorrectionConfidence.MEDIUM;
          corrections.push({
            original: windowText,
            corrected: best.candidate,
            confidence,
            source: 'fuzzy'
          });

          // Replace words in window
          words[i] = best.candidate;
          for (let k = 1; k < size; k++) {
            words[i + k] = '';
          }

          // Mark indices as replaced
          for (let k = 0; k < size; k++) {
            appliedIndices.add(i + k);
          }
        }
      }
    }

    // Reconstruct normalized text
    const normalizedText = words.filter(w => w !== '').join(' ');

    // Cache the outcome
    if (corrections.length > 0) {
      const avgConfidence = corrections[0].confidence;
      this.cache.set(originalText, normalizedText, avgConfidence === CorrectionConfidence.HIGH ? 1.0 : 0.7);
    }

    return {
      originalText,
      normalizedText,
      corrections
    };
  }
}
