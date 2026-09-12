import { GlossaryService } from '../glossary-service.js';

export interface SemanticClassification {
  intentArea?: string;
  runningStyle?: string;
  categories: string[];
}

export class SemanticAnalyzer {
  private glossaryService: GlossaryService;

  constructor(glossaryService: GlossaryService) {
    this.glossaryService = glossaryService;
  }

  /**
   * Classify user query intent area and specific taxonomy dimensions (e.g. running styles)
   */
  public analyze(text: string): SemanticClassification {
    const normalized = text.toLowerCase();
    const categories: string[] = [];
    const classification: SemanticClassification = { categories };

    // Intent Area detection
    if (normalized.includes('parent') || normalized.includes('breeding') || normalized.includes('factor')) {
      classification.intentArea = 'Parent';
      categories.push('parent_inquiry');
    } else if (normalized.includes('leaderboard') || normalized.includes('score') || normalized.includes('rank')) {
      classification.intentArea = 'Leaderboard';
      categories.push('leaderboard_view');
    } else if (normalized.includes('build') || normalized.includes('setup') || normalized.includes('strategy')) {
      classification.intentArea = 'Build';
      categories.push('build_optimization');
    } else if (normalized.includes('link') || normalized.includes('unlink') || normalized.includes('approval')) {
      classification.intentArea = 'Club Operations';
      categories.push('club_operation');
    }

    // Running style detection using terminology engine mapping or direct keywords
    const terminologyEngine = this.glossaryService.getTerminologyEngine();
    
    const runningStyleKeywords = [
      { key: 'nige', canonical: 'Front Runner' },
      { key: 'runner', canonical: 'Front Runner' },
      { key: 'front runner', canonical: 'Front Runner' },
      { key: 'senkou', canonical: 'Pace Chaser' },
      { key: 'senko', canonical: 'Pace Chaser' },
      { key: 'pace chaser', canonical: 'Pace Chaser' },
      { key: 'sashi', canonical: 'Late Surger' },
      { key: 'late surger', canonical: 'Late Surger' },
      { key: 'oikomi', canonical: 'End Closer' },
      { key: 'end closer', canonical: 'End Closer' }
    ];

    for (const style of runningStyleKeywords) {
      if (normalized.includes(style.key)) {
        // Resolve canonical name via glossary/terminology engine
        const resolved = terminologyEngine.resolveTerm(style.canonical);
        classification.runningStyle = resolved;
        categories.push('tactical_running_style');
        break;
      }
    }

    return classification;
  }
}
