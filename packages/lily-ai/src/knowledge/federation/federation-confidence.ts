import { KnowledgeProviderResult } from './federation-result.js';

export interface ConfidenceAssessment {
  overallConfidence: number;
  weightedScore: number;
  providerScores: Record<string, number>;
  sourceCount: number;
  agreementBonus: number;
  authorityWeightSum: number;
}

export class FederationConfidenceEngine {
  /**
   * Calculates overall federated confidence from participating provider results.
   */
  public static calculate(results: Record<string, KnowledgeProviderResult>): ConfidenceAssessment {
    const providerKeys = Object.keys(results);
    if (providerKeys.length === 0) {
      return {
        overallConfidence: 0,
        weightedScore: 0,
        providerScores: {},
        sourceCount: 0,
        agreementBonus: 0,
        authorityWeightSum: 0
      };
    }

    const providerScores: Record<string, number> = {};
    let weightedSum = 0;
    let weightSum = 0;

    for (const key of providerKeys) {
      const res = results[key];
      const authority = Math.max(1, res.authority || 50);
      const conf = Math.max(0, Math.min(1, res.confidence || 0.5));

      providerScores[key] = conf;

      // Weight is proportional to authority score (e.g. 100 for Taxonomy, 95 for DB, 90 for Handbook, 80 for Lexical)
      const weight = authority / 100;
      weightedSum += conf * weight;
      weightSum += weight;
    }

    const baseScore = weightSum > 0 ? weightedSum / weightSum : 0;

    // Multi-source agreement bonus (+0.02 per additional corroborating provider with conf >= 0.7, max +0.06)
    const reliableSources = providerKeys.filter(k => (results[k].confidence || 0) >= 0.7).length;
    const agreementBonus = reliableSources > 1 ? Math.min(0.06, (reliableSources - 1) * 0.02) : 0;

    const finalConfidence = Math.min(1.0, Math.round((baseScore + agreementBonus) * 100) / 100);

    return {
      overallConfidence: finalConfidence,
      weightedScore: Math.round(baseScore * 100) / 100,
      providerScores,
      sourceCount: providerKeys.length,
      agreementBonus,
      authorityWeightSum: weightSum
    };
  }
}
