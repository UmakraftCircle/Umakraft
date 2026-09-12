import { OutboundPayload } from './federation-types.js';
import { PrivacyEngine } from './privacy-engine.js';

export class IntelligenceExchange {
  private privacyEngine = new PrivacyEngine();
  private localData: Partial<OutboundPayload> = {
    nodeId: 'umakraft_sea',
    metaTrends: { 'Front Runner': 58, 'Pace Chaser': 20, 'Late Surger': 15, 'End Closer': 7 },
    parentDemands: {
      'Long Distance End Closer': { requests: 182, supply: 37 }
    },
    benchmarks: {
      'fanCompliance': 93,
      'parentCoverage': 82
    }
  };

  /**
   * Prepares and sanitizes the outbound exchange payload
   */
  public prepareOutbound(): OutboundPayload {
    return this.privacyEngine.sanitize(this.localData) as OutboundPayload;
  }

  /**
   * Aggregates multiple inbound payloads taking into account trust-level multipliers
   */
  public aggregateInbound(payloads: { payload: OutboundPayload; weight: number }[]): {
    metaTrends: Record<string, number>;
    parentDemands: Record<string, { requests: number; supply: number }>;
    benchmarks: Record<string, { total: number; count: number }>;
  } {
    const metaTrendsAgg: Record<string, { totalWeighted: number; totalWeight: number }> = {};
    const parentDemandsAgg: Record<string, { requests: number; supply: number }> = {};
    const benchmarksAgg: Record<string, { sum: number; count: number }> = {};

    for (const { payload, weight } of payloads) {
      // 1. Meta trends aggregation
      for (const [strategy, usage] of Object.entries(payload.metaTrends || {})) {
        if (!metaTrendsAgg[strategy]) {
          metaTrendsAgg[strategy] = { totalWeighted: 0, totalWeight: 0 };
        }
        metaTrendsAgg[strategy].totalWeighted += usage * weight;
        metaTrendsAgg[strategy].totalWeight += weight;
      }

      // 2. Parent demand aggregation (raw count summed up)
      for (const [lineage, demand] of Object.entries(payload.parentDemands || {})) {
        if (!parentDemandsAgg[lineage]) {
          parentDemandsAgg[lineage] = { requests: 0, supply: 0 };
        }
        parentDemandsAgg[lineage].requests += demand.requests;
        parentDemandsAgg[lineage].supply += demand.supply;
      }

      // 3. Benchmark aggregation
      for (const [metric, val] of Object.entries(payload.benchmarks || {})) {
        if (!benchmarksAgg[metric]) {
          benchmarksAgg[metric] = { sum: 0, count: 0 };
        }
        benchmarksAgg[metric].sum += val;
        benchmarksAgg[metric].count += 1;
      }
    }

    // Final calculations
    const metaTrends: Record<string, number> = {};
    for (const [strat, data] of Object.entries(metaTrendsAgg)) {
      metaTrends[strat] = data.totalWeight > 0 ? Math.round(data.totalWeighted / data.totalWeight) : 0;
    }

    const benchmarks: Record<string, { total: number; count: number }> = {};
    for (const [metric, data] of Object.entries(benchmarksAgg)) {
      benchmarks[metric] = { total: data.sum, count: data.count };
    }

    return {
      metaTrends,
      parentDemands: parentDemandsAgg,
      benchmarks
    };
  }
}
