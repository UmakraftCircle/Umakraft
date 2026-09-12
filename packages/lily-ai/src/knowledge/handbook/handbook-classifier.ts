import { LanguageAnalysis } from '../../services/language/language-analysis.js';

export interface HandbookClassification {
  domain: 'club_rules' | 'membership' | 'fan_requirements' | 'activity_rules' | 'linking' | 'club_procedures' | 'faq' | 'general';
  confidence: number;
}

export class HandbookClassifier {
  public classify(analysis: LanguageAnalysis): HandbookClassification {
    const msg = analysis.normalizedMessage;

    if (msg.includes('fan') && (msg.includes('minimum') || msg.includes('requirement') || msg.includes('target') || msg.includes('150m'))) {
      return { domain: 'fan_requirements', confidence: 0.95 };
    }

    if (msg.includes('inactive') || msg.includes('kick') || msg.includes('activity')) {
      return { domain: 'activity_rules', confidence: 0.95 };
    }

    if (msg.includes('link') || msg.includes('connect')) {
      return { domain: 'linking', confidence: 0.90 };
    }

    if (msg.includes('join') || msg.includes('membership') || msg.includes('apply')) {
      return { domain: 'membership', confidence: 0.90 };
    }

    if (msg.includes('rule') || msg.includes('policy')) {
      return { domain: 'club_rules', confidence: 0.85 };
    }

    if (msg.includes('procedure') || msg.includes('how to') || msg.includes('process')) {
      return { domain: 'club_procedures', confidence: 0.80 };
    }

    if (msg.includes('what') || msg.includes('how') || msg.includes('faq')) {
      return { domain: 'faq', confidence: 0.70 };
    }

    return { domain: 'general', confidence: 0.40 };
  }
}
