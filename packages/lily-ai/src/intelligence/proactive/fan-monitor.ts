import { NotificationScore, IntelligencePriority, Notification } from './proactive-types.js';

export class NotificationEngine {
  private THRESHOLD = 0.7;

  public shouldNotify(score: NotificationScore): boolean {
    const totalScore = (score.usefulness + score.urgency + score.confidence) / 3;
    return totalScore >= this.THRESHOLD;
  }

  public format(notification: Notification): string {
    return `[${notification.priority}] ${notification.title}: ${notification.message}`;
  }
}

export class FanMonitor {
  public checkFanStatus(current: number, target: number): Notification | null {
    if (current < target) {
      return {
        title: 'Fan Deficit Alert',
        message: 'You are behind pace for the monthly target.',
        priority: IntelligencePriority.HIGH,
        score: { usefulness: 0.9, urgency: 0.8, confidence: 1.0 }
      };
    }
    return null;
  }
}
