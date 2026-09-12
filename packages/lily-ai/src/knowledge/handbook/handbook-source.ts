import { HandbookClassifier } from './handbook-classifier.js';
import { searchHandbook } from './handbook-search.js';
import { HandbookResult } from './handbook-result.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';

export interface KnowledgeSourceResult {
  domain: string;
  source: string;
  confidence: number;
  data: any;
}

export class HandbookKnowledgeSource {
  private classifier = new HandbookClassifier();

  public async query(analysis: LanguageAnalysis): Promise<HandbookResult[]> {
    return searchHandbook(analysis.normalizedMessage);
  }

  public classify(analysis: LanguageAnalysis) {
    return this.classifier.classify(analysis);
  }
}

export { HandbookKnowledgeSource as HandbookLegacyKnowledgeSource };

