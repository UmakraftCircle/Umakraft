import { MetaAnalyzer } from './meta-analyzer.js';

export class CompetitionAdvisor {
  private analyzer = new MetaAnalyzer();
  
  public adviseCompetition(competition: string) {
    return { recommendedCharacter: 'Kitasan Black', reason: 'Meta favors long-distance.' };
  }
}
