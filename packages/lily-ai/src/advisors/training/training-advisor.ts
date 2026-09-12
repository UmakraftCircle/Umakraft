import { TrainingContext, TrainingRecommendation } from './training-types.js';
import { TurnAnalyzer } from './turn-analyzer.js';
import { TrainingRecommendationEngine } from './training-recommendation.js';

export class TrainingAdvisor {
  private turnAnalyzer = new TurnAnalyzer();
  private recommendationEngine = new TrainingRecommendationEngine();

  public getAdvice(context: TrainingContext): TrainingRecommendation {
    const turnAnalysis = this.turnAnalyzer.analyze(context);
    return this.recommendationEngine.recommend(context);
  }
}
