import { TAXONOMY_DATA } from '../../knowledge/taxonomy/data.js';

export interface ComprehensionContext {
  character?: string;
  event?: string;
  problem?: string;
  emotion?: string;
  currentFans?: number;
  requiredFans?: number;
}

export class ContextBuilder {
  private problemsList = ['lose', 'losing', 'lost', 'struggle', 'struggling', 'fail', 'failing', 'defeat', 'hard', 'stuck'];
  private emotionsList = [
    { words: ['worried', 'worry', 'scared', 'afraid', 'nervous', 'concern', 'concerned'], emotion: 'concern' },
    { words: ['happy', 'excited', 'good', 'great', 'awesome', 'poggers'], emotion: 'joy' },
    { words: ['angry', 'mad', 'frustrated', 'annoyed'], emotion: 'frustration' }
  ];

  /**
   * Build structured context from text using taxonomy indicators and keyword extraction
   */
  public buildContext(text: string): ComprehensionContext {
    const context: ComprehensionContext = {};
    const normalized = text.toLowerCase();

    // 1. Resolve character from taxonomy
    const characterEntity = TAXONOMY_DATA.find(e => 
      e.type === 'character' && 
      (normalized.includes(e.canonical.toLowerCase()) || e.aliases.some(a => normalized.includes(a.toLowerCase())))
    );
    if (characterEntity) {
      context.character = characterEntity.canonical;
    }

    // 2. Resolve event/competition from taxonomy
    const eventEntity = TAXONOMY_DATA.find(e => 
      e.type === 'track' && 
      (normalized.includes(e.canonical.toLowerCase()) || e.aliases.some(a => normalized.includes(a.toLowerCase())))
    );
    if (eventEntity) {
      context.event = eventEntity.canonical;
    } else {
      // Direct substring for common events like Arima Kinen or Champions Meeting
      if (normalized.includes('arima kinen')) {
        context.event = 'Arima Kinen';
      } else if (normalized.includes('champions meeting') || normalized.includes('cm')) {
        context.event = 'Champions Meeting';
      } else if (normalized.includes('league of heroes') || normalized.includes('loh')) {
        context.event = 'League of Heroes';
      }
    }

    // 3. Problem detection
    const matchedProblem = this.problemsList.find(prob => normalized.includes(prob));
    if (matchedProblem) {
      context.problem = 'losing';
    }

    // 4. Emotion detection
    const matchedEmotion = this.emotionsList.find(emo => 
      emo.words.some(w => normalized.includes(w))
    );
    if (matchedEmotion) {
      context.emotion = matchedEmotion.emotion;
    }

    // 5. Fans extraction
    const currentFanMatch = normalized.match(/(?:current\s+)?fans\s*[:=]?\s*(\d+(?:\.\d+)?[mMgG]?)/i) || normalized.match(/have\s+(\d+(?:\.\d+)?[mMgG]?)\s+fans/i);
    const requiredFanMatch = normalized.match(/required\s*(?:fans)?\s*[:=]?\s*(\d+(?:\.\d+)?[mMgG]?)/i) || normalized.match(/requirement\s+(?:is\s+)?(\d+(?:\.\d+)?[mMgG]?)/i);

    if (currentFanMatch) {
      context.currentFans = this.parseValue(currentFanMatch[1]);
    }
    if (requiredFanMatch) {
      context.requiredFans = this.parseValue(requiredFanMatch[1]);
    }

    return context;
  }

  private parseValue(raw: string): number {
    let val = parseFloat(raw);
    if (raw.toLowerCase().endsWith('m')) {
      val *= 1_000_000;
    }
    return val;
  }
}
