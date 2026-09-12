import { IntelligencePriority, Notification } from './proactive-types.js';

export class ParentPoolMonitor {
  public checkPoolHealth(stats: Record<string, number>): Notification | null {
    if (stats['Long End Closer'] < 5) {
      return {
        title: 'Parent Pool Gap Detected',
        message: 'Long End Closer lineage is underrepresented.',
        priority: IntelligencePriority.NORMAL,
        score: { usefulness: 0.8, urgency: 0.5, confidence: 0.9 }
      };
    }
    return null;
  }
}

