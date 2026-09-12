import { GlossaryService } from './glossary-service.js';
import { ReadingEngine } from './reading-engine.js';

export interface ComprehensionResult {
  detectedTerms: string[];
  detectedNumbers: number[];
  confidence: number;
}

export class ComprehensionEngine {
  private glossaryService = new GlossaryService();
  private readingEngine = new ReadingEngine();

  public comprehend(text: string): ComprehensionResult {
    const matchedGlossary = this.glossaryService.matchTerms(text);
    const extractedInfo = this.readingEngine.extractInfo(text);

    const detectedTerms = matchedGlossary.map(g => g.term);
    const detectedNumbers = extractedInfo.numbers;

    // Direct, deterministic confidence score based on matches
    let confidence = 0.5;
    if (detectedTerms.length > 0) confidence += 0.3;
    if (detectedNumbers.length > 0) confidence += 0.1;
    confidence = Math.min(1.0, confidence);

    return {
      detectedTerms,
      detectedNumbers,
      confidence
    };
  }
}
