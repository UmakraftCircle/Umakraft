import { FeedbackCollector, OutcomeTracker, RecommendationScorer } from './feedback-components.js';
import { ConfidenceCalibrator, PatternDetector, TrainerPreferenceManager } from './preference-components.js';

export class LearningService {
  private feedbackCollector = new FeedbackCollector();
  private outcomeTracker = new OutcomeTracker();
  
  public processOutcome(recommendationId: string, success: boolean): void {
    this.outcomeTracker.trackOutcome(recommendationId, success);
  }
}
