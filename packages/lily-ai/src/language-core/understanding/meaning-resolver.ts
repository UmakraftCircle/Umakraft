import { GoalDetector } from './goal-detector.js';

export interface Meaning {
  goal?: string;
  character?: string;
  runningStyle?: string;
  event?: string;
  factor?: string;
  [key: string]: any;
}

export class MeaningResolver {
  private goalDetector = new GoalDetector();

  /**
   * Resolves the ultimate semantic meaning from unstructured information
   */
  public resolve(text: string, facts: any[], entities: any[]): Meaning {
    const normalized = text.toLowerCase();
    const goal = this.goalDetector.detect(text);
    const meaning: Meaning = { goal };

    // Look for running styles
    if (normalized.includes('front runner') || normalized.includes('nige')) {
      meaning.runningStyle = 'Front Runner';
    } else if (normalized.includes('pace chaser') || normalized.includes('senkou')) {
      meaning.runningStyle = 'Pace Chaser';
    } else if (normalized.includes('late surger') || normalized.includes('sashi')) {
      meaning.runningStyle = 'Late Surger';
    } else if (normalized.includes('end closer') || normalized.includes('oikomi')) {
      meaning.runningStyle = 'End Closer';
    }

    // Look for characters from entities or facts or text search
    const characterEntities = entities.filter(e => e.type === 'character' || e.type === 'Umamusume' || e.type === 'Umamusume Character');
    if (characterEntities.length > 0) {
      meaning.character = characterEntities[0].name;
    } else {
      // Direct text search fallback
      if (normalized.includes('oguri cap') || normalized.includes('oguri')) {
        meaning.character = 'Oguri Cap';
      } else if (normalized.includes('kitasan black') || normalized.includes('kitasan')) {
        meaning.character = 'Kitasan Black';
      } else if (normalized.includes('gold ship')) {
        meaning.character = 'Gold Ship';
      }
    }

    // Look for event references
    const eventEntities = entities.filter(e => e.type === 'event' || e.type === 'race');
    if (eventEntities.length > 0) {
      meaning.event = eventEntities[0].name;
    } else {
      if (normalized.includes('arima kinen') || normalized.includes('arima')) {
        meaning.event = 'Arima Kinen';
      } else if (normalized.includes('japan cup')) {
        meaning.event = 'Japan Cup';
      } else if (normalized.includes('ura finals')) {
        meaning.event = 'URA Finals';
      }
    }

    // Try extracting factor types
    if (normalized.includes('speed factor')) {
      meaning.factor = 'Speed';
    } else if (normalized.includes('stamina factor')) {
      meaning.factor = 'Stamina';
    } else if (normalized.includes('power factor')) {
      meaning.factor = 'Power';
    }

    return meaning;
  }
}
