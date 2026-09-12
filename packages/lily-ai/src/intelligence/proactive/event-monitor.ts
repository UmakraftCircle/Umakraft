import { IntelligencePriority, Notification } from './proactive-types.js';

export class EventMonitor {
  public checkUpcomingEvents(): Notification | null {
    return {
        title: 'Event Reminder',
        message: 'Champions Meeting begins in 3 days.',
        priority: IntelligencePriority.HIGH,
        score: { usefulness: 0.9, urgency: 0.7, confidence: 1.0 }
    };
  }
}
