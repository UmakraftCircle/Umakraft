import { KnowledgeResult } from './knowledge-result.js';
import { KnowledgeContext } from './knowledge-context.js';

export class KnowledgeRanking {
  /**
   * Authority weight multiplier:
   * Official Taxonomy (100)
   * Official Database (85)
   * Official Handbook (75)
   * Official Glossary (65)
   * Generated Knowledge (40)
   * User Content (20)
   */
  public rank(results: KnowledgeResult[], context?: KnowledgeContext): KnowledgeResult[] {
    if (!results || results.length === 0) return [];

    return [...results].sort((a, b) => {
      // 1. Context matching bonus
      const bonusA = this.calculateContextBonus(a, context);
      const bonusB = this.calculateContextBonus(b, context);

      const scoreA = (a.authority * 10) + (a.confidence * 20) + bonusA;
      const scoreB = (b.authority * 10) + (b.confidence * 20) + bonusB;

      return scoreB - scoreA;
    });
  }

  private calculateContextBonus(result: KnowledgeResult, context?: KnowledgeContext): number {
    if (!context) return 0;
    let bonus = 0;

    // Check if result content or metadata matches context category/intent
    const meta = result.metadata || {};
    const content = result.content as Record<string, unknown> | undefined;

    const resultType = (meta.type || content?.type || '') as string;
    const resultCategory = (meta.category || content?.category || '') as string;

    if (context.category && (resultCategory.toLowerCase() === context.category.toLowerCase() || resultType.toLowerCase() === context.category.toLowerCase())) {
      bonus += 50;
    }

    if (context.domain && (meta.domain === context.domain || content?.domain === context.domain)) {
      bonus += 30;
    }

    // Context user goal / intent bonus (e.g. parent search prefers running styles and factors)
    if (context.intent === 'parent_search' || context.userGoal?.toLowerCase().includes('parent')) {
      if (resultType === 'running_style' || resultType === 'factor' || resultType === 'distance') {
        bonus += 40;
      }
    }

    return bonus;
  }
}
