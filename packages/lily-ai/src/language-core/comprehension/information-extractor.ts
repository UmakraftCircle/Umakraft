import { TAXONOMY_DATA } from '../../knowledge/taxonomy/data.js';

export interface ExtractedInformation {
  character?: string;
  stats?: Record<string, number>;
  events?: string[];
}

export class InformationExtractor {
  /**
   * Extracts structured information from user queries/inputs
   */
  public extract(text: string): ExtractedInformation {
    const info: ExtractedInformation = {};
    const normalized = text.toLowerCase();

    // 1. Character Extraction
    const characterEntity = TAXONOMY_DATA.find(e => 
      e.type === 'character' && 
      (normalized.includes(e.canonical.toLowerCase()) || e.aliases.some(a => normalized.includes(a.toLowerCase())))
    );
    if (characterEntity) {
      info.character = characterEntity.canonical;
    }

    // 2. Stat Metrics Extraction
    const stats: Record<string, number> = {};
    const statRegex = /(speed|stamina|power|guts|wit|wisdom)\s*[:=]?\s*(\d+)/gi;
    let match;
    while ((match = statRegex.exec(text)) !== null) {
      const statName = match[1].toLowerCase();
      const statValue = parseInt(match[2], 10);
      stats[statName] = statValue;
    }

    if (Object.keys(stats).length > 0) {
      info.stats = stats;
    }

    // 3. Competitions / Events Extraction
    const events: string[] = [];
    const eventEntity = TAXONOMY_DATA.find(e => 
      e.type === 'track' && 
      (normalized.includes(e.canonical.toLowerCase()) || e.aliases.some(a => normalized.includes(a.toLowerCase())))
    );
    if (eventEntity) {
      events.push(eventEntity.canonical);
    } else {
      if (normalized.includes('arima kinen')) events.push('Arima Kinen');
      if (normalized.includes('champions meeting')) events.push('Champions Meeting');
      if (normalized.includes('league of heroes')) events.push('League of Heroes');
    }

    if (events.length > 0) {
      info.events = events;
    }

    return info;
  }
}
