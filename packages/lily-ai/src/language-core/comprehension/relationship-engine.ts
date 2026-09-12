import { Fact } from './fact-detector.js';

export interface Relationship {
  source: string;
  target: string;
  type: string;
  description: string;
}

export class RelationshipEngine {
  /**
   * Identifies relationships between active facts or concepts inside the text
   */
  public analyzeRelationships(facts: Fact[], text: string): Relationship[] {
    const relationships: Relationship[] = [];

    // Check Fan metrics comparison
    const currentFanFact = facts.find(f => f.attribute === 'Fans');
    const requiredFanFact = facts.find(f => f.attribute === 'Required Fans');

    if (currentFanFact && requiredFanFact) {
      const cur = currentFanFact.value;
      const req = requiredFanFact.value;
      if (cur < req) {
        relationships.push({
          source: 'Current Fans',
          target: 'Required Fans',
          type: 'deficit',
          description: `Current fans (${cur}) is less than required fans (${req}). Deficit of ${req - cur} fans.`
        });
      } else {
        relationships.push({
          source: 'Current Fans',
          target: 'Required Fans',
          type: 'surplus',
          description: `Current fans (${cur}) meets or exceeds required fans (${req}).`
        });
      }
    }

    // Check Running Style + Distance Category relationship
    const normalized = text.toLowerCase();
    
    const runningStyles = ['front runner', 'nige', 'pace chaser', 'senkou', 'late surger', 'sashi', 'end closer', 'oikomi'];
    const distances = ['sprint', 'mile', 'medium', 'long'];

    const matchedStyle = runningStyles.find(style => normalized.includes(style));
    const matchedDistance = distances.find(dist => normalized.includes(dist));

    if (matchedStyle && matchedDistance) {
      relationships.push({
        source: matchedStyle,
        target: matchedDistance,
        type: 'tactical_setup',
        description: `Running style '${matchedStyle}' paired with distance preference '${matchedDistance}'.`
      });
    }

    return relationships;
  }
}
