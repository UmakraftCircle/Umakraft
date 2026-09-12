import { KnowledgeProviderResult, ResponsePlanStep } from './federation-result.js';
import { FederationContext } from './federation-context.js';

export interface RankedItem<T = any> {
  item: T;
  sourceProvider: string;
  authority: number;
  confidence: number;
  relevanceScore: number;
  finalScore: number;
}

export class FederationRankingEngine {
  /**
   * Ranks items across providers considering authority (50%), confidence (30%), and context match (20%).
   */
  public static rankItems<T = any>(
    items: Array<{ item: T; sourceProvider: string; authority: number; confidence: number; textRepresentation?: string }>,
    context: FederationContext
  ): RankedItem<T>[] {
    const scored = items.map(entry => {
      const authNorm = Math.min(1.0, entry.authority / 100);
      const confNorm = Math.min(1.0, Math.max(0, entry.confidence));
      const relNorm = this.calculateRelevance(entry.textRepresentation || JSON.stringify(entry.item), context);

      const finalScore = Math.round((authNorm * 0.45 + confNorm * 0.35 + relNorm * 0.20) * 1000) / 1000;

      return {
        item: entry.item,
        sourceProvider: entry.sourceProvider,
        authority: entry.authority,
        confidence: entry.confidence,
        relevanceScore: relNorm,
        finalScore
      };
    });

    return scored.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Calculates contextual text relevance score (0.0 to 1.0).
   */
  public static calculateRelevance(text: string, context: FederationContext): number {
    if (!text) return 0.5;
    const lower = text.toLowerCase();
    let matches = 0;
    let totalChecks = 0;

    if (context.runningStyle) {
      totalChecks++;
      if (lower.includes(context.runningStyle.toLowerCase())) matches++;
    }
    if (context.character) {
      totalChecks++;
      if (lower.includes(context.character.toLowerCase())) matches++;
    }
    if (context.distance) {
      totalChecks++;
      if (lower.includes(context.distance.toLowerCase())) matches++;
    }
    if (context.surface) {
      totalChecks++;
      if (lower.includes(context.surface.toLowerCase())) matches++;
    }
    for (const entity of context.entities || []) {
      totalChecks++;
      if (lower.includes(entity.toLowerCase())) matches++;
    }

    if (totalChecks === 0) return 0.7; // default moderate relevance if no context constraints
    return Math.min(1.0, Math.max(0.2, matches / totalChecks));
  }

  /**
   * Ranks response plan steps by logical importance:
   * 1. Current Situation (Database live stats)
   * 2. Relevant Guide (Handbook strategy)
   * 3. Foundational Concept (Taxonomy mechanic)
   * 4. Recommended Action (Synthesized action)
   * 5. Lexical Note (Vocabulary clarification)
   */
  public static rankPlanSteps(steps: ResponsePlanStep[]): ResponsePlanStep[] {
    const orderMap: Record<string, number> = {
      current_situation: 1,
      relevant_guide: 2,
      foundational_concept: 3,
      recommended_action: 4,
      lexical_note: 5
    };

    return [...steps].sort((a, b) => {
      const orderA = orderMap[a.type] ?? 99;
      const orderB = orderMap[b.type] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.confidence - a.confidence;
    });
  }
}
