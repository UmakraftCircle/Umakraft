export interface Pattern {
  patternType: string;
  pattern?: string;
  category?: string;
  interest?: string;
  count?: number;
  description: string;
}

export class PatternEngine {
  public detect(text: string, previousInteractions: any[] = []): Pattern[] {
    const patterns: Pattern[] = [];
    const normalized = text.toLowerCase();

    // 1. Detect Loss Patterns (e.g. "Lost 5 long-distance races", "losing in medium races", "lost 5 long distance races")
    const lossMatch =
      normalized.match(/lost\s*(\d+)\s*([\w\-]+)\s*races/i) ||
      normalized.match(/losing\s*in\s*([\w\-]+)\s*races/i) ||
      normalized.match(/(\d+)\s*([\w\-]+)\s*losses/i);

    if (lossMatch) {
      const count = parseInt(lossMatch[1], 10) || 1;
      const type = (lossMatch[2] || '').replace(/[-_]/g, '_').toLowerCase();
      const category = type.includes('long')
        ? 'long_distance_losses'
        : type.includes('medium')
        ? 'medium_distance_losses'
        : type.includes('sprint')
        ? 'sprint_distance_losses'
        : `${type}_losses`;

      patterns.push({
        patternType: 'consecutive_losses',
        pattern: category,
        category,
        count,
        description: `Recurring pattern: ${count} recorded loss(es) in ${lossMatch[2] || 'races'}`
      });
    } else if (normalized.includes('lost') && (normalized.includes('long-distance') || normalized.includes('long distance'))) {
      const countMatch = normalized.match(/lost\s*(\d+)/i);
      const count = countMatch ? parseInt(countMatch[1], 10) : 1;
      patterns.push({
        patternType: 'consecutive_losses',
        pattern: 'long_distance_losses',
        category: 'long_distance_losses',
        count,
        description: `Recurring loss pattern in long-distance races (${count})`
      });
    }

    // 2. Detect Strategy / Taxonomy Preference Patterns (e.g. "Repeated Front Runner searches", "Front Runner")
    if (normalized.includes('front runner') || normalized.includes('runner') || normalized.includes('nige')) {
      patterns.push({
        patternType: 'strategy_preference',
        pattern: 'front_runner',
        category: 'running_style_preference',
        interest: 'front_runner',
        description: 'Frequent interest in Front Runner tactics'
      });
    }
    if (normalized.includes('pace chaser') || normalized.includes('senko')) {
      patterns.push({
        patternType: 'strategy_preference',
        pattern: 'pace_chaser',
        category: 'running_style_preference',
        interest: 'pace_chaser',
        description: 'Frequent interest in Pace Chaser tactics'
      });
    }
    if (normalized.includes('late surger') || normalized.includes('sashi')) {
      patterns.push({
        patternType: 'strategy_preference',
        pattern: 'late_surger',
        category: 'running_style_preference',
        interest: 'late_surger',
        description: 'Frequent interest in Late Surger tactics'
      });
    }
    if (normalized.includes('end closer') || normalized.includes('oikomi')) {
      patterns.push({
        patternType: 'strategy_preference',
        pattern: 'end_closer',
        category: 'running_style_preference',
        interest: 'end_closer',
        description: 'Frequent interest in End Closer tactics'
      });
    }

    // 3. Detect repeated query terms across interaction history
    if (previousInteractions && previousInteractions.length >= 2) {
      patterns.push({
        patternType: 'session_frequency',
        pattern: 'session_multi_turn',
        count: previousInteractions.length,
        description: 'Active multi-turn query continuity detected'
      });
    }

    return patterns;
  }
}
