import { GlossaryService } from '../glossary-service.js';

export class ExplanationEngine {
  private glossaryService: GlossaryService;

  private customExplanations: Record<string, string> = {
    'front runner': 'Front Runner is a running style that aims to lead the race from the start and maintain the lead throughout.',
    'nige': 'Front Runner (Nige) is a running style that aims to take the lead early and control the pace of the race.',
    'pace chaser': 'Pace Chaser is a running style where the runner positions themselves just behind the front runners, maintaining high stamina conservation.',
    'senkou': 'Pace Chaser (Senkou) is a running style where the runner maintains a close second-tier position before making a push in the final corner.',
    'late surger': 'Late Surger is a running style that focuses on conserving stamina in the pack and bursting forward in the final leg.',
    'sashi': 'Late Surger (Sashi) is a running style that conserves stamina in the middle of the pack and relies on a powerful burst in the final straight.',
    'end closer': 'End Closer is a running style where the runner stays at the very back of the pack, unleashing a massive top speed surge near the finish.',
    'oikomi': 'End Closer (Oikomi) is a running style where the runner stays at the extreme rear, unleashing a devastating acceleration in the final straight.',
    'speed': 'Speed is a key attribute that determines the maximum velocity an Umamusume can reach on straightaways.',
    'stamina': 'Stamina is a key attribute that determines the endurance pool, preventing exhaustion in long-distance races.',
    'power': 'Power is a key attribute that determines acceleration and the ability to fight through pack congestion or steep hills.',
    'guts': 'Guts is a key attribute that reduces stamina consumption when battling alongside other runners and sustains speed when exhausted.',
    'wit': 'Wit is a key attribute that determines skill activation frequency, pathing intelligence, and downhills stamina conservation.'
  };

  constructor(glossaryService: GlossaryService) {
    this.glossaryService = glossaryService;
  }

  /**
   * Generates a clear, informative explanation of a domain term or concept
   */
  public explain(term: string): string {
    const normalized = term.trim().toLowerCase();

    // 1. Try our highly specialized custom explanation database
    if (this.customExplanations[normalized]) {
      return this.customExplanations[normalized];
    }

    // 2. Try lookup via the Glossary Service
    const matches = this.glossaryService.matchTerms(term);
    if (matches.length > 0) {
      const match = matches[0];
      return `${match.term} is a recognized term categorized under ${match.domain || 'general domain'}. Definition: ${match.description}`;
    }

    // 3. Fallback explanation
    return `The term "${term}" is an active concept within the training system. Ensure it is aligned with your character build.`;
  }
}
