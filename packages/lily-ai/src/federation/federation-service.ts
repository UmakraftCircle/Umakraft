import { FederationRegistry } from './federation-registry.js';
import { TrustEngine } from './trust-engine.js';
import { IntelligenceExchange } from './intelligence-exchange.js';
import { FederationClient } from './federation-client.js';
import { FederationServer } from './federation-server.js';
import { OutboundPayload, CommunityBenchmark, SharedMetaTrends, SharedParentDemand } from './federation-types.js';

export class FederationService {
  private registry = new FederationRegistry();
  private trustEngine = new TrustEngine();
  private exchange = new IntelligenceExchange();
  private client = new FederationClient();
  private server = new FederationServer();

  /**
   * Generates local vs federation benchmarks
   */
  public generateBenchmarks(localCompliance: number, localCoverage: number): CommunityBenchmark[] {
    const nodes = this.registry.getAll();
    
    // Simulate fetching payloads and weights
    const payloadsWithWeights = nodes.map(node => {
      const weight = this.trustEngine.getWeightMultiplier(node.trustLevel);
      
      // Node specific data variation
      const benchmarkData: Record<string, number> = {};
      if (node.id === 'umakraft_sea') {
        benchmarkData.fanCompliance = localCompliance;
        benchmarkData.parentCoverage = localCoverage;
      } else if (node.id === 'node_jp_east') {
        benchmarkData.fanCompliance = 89;
        benchmarkData.parentCoverage = 65;
      } else {
        benchmarkData.fanCompliance = 87;
        benchmarkData.parentCoverage = 69;
      }

      const p: OutboundPayload = {
        nodeId: node.id,
        metaTrends: {},
        parentDemands: {},
        benchmarks: benchmarkData
      };

      return { payload: p, weight };
    });

    const aggregated = this.exchange.aggregateInbound(payloadsWithWeights);

    const benchmarks: CommunityBenchmark[] = [];
    for (const [metric, data] of Object.entries(aggregated.benchmarks)) {
      const localVal = metric === 'fanCompliance' ? localCompliance : localCoverage;
      const average = Math.round(data.total / data.count);
      benchmarks.push({
        metric,
        localValue: localVal,
        federatedAverage: average
      });
    }

    return benchmarks;
  }

  /**
   * Aggregates global meta trends from federation nodes
   */
  public getFederatedMetaTrends(localMeta: Record<string, number>): SharedMetaTrends[] {
    const nodes = this.registry.getAll();
    const payloadsWithWeights = nodes.map(node => {
      const weight = this.trustEngine.getWeightMultiplier(node.trustLevel);
      let trends = { 'Front Runner': 58, 'Pace Chaser': 20, 'Late Surger': 15, 'End Closer': 7 };
      
      if (node.id === 'node_jp_east') {
        trends = { 'Front Runner': 68, 'Pace Chaser': 15, 'Late Surger': 10, 'End Closer': 7 };
      } else if (node.id === 'node_na_west') {
        trends = { 'Front Runner': 62, 'Pace Chaser': 18, 'Late Surger': 12, 'End Closer': 8 };
      }

      const p: OutboundPayload = {
        nodeId: node.id,
        metaTrends: trends,
        parentDemands: {},
        benchmarks: {}
      };

      return { payload: p, weight };
    });

    const aggregated = this.exchange.aggregateInbound(payloadsWithWeights);

    const trends: SharedMetaTrends[] = [];
    for (const [strategy, federatedUsage] of Object.entries(aggregated.metaTrends)) {
      trends.push({
        strategy,
        localUsage: localMeta[strategy] || 0,
        federatedUsage,
        confidence: 'HIGH'
      });
    }

    return trends;
  }

  /**
   * Evaluates parent demand across the federation network
   */
  public getFederatedParentDemand(lineage: string, localRequests: number, localSupply: number): SharedParentDemand {
    const nodes = this.registry.getAll();
    const payloadsWithWeights = nodes.map(node => {
      const weight = this.trustEngine.getWeightMultiplier(node.trustLevel);
      let demands = { requests: localRequests, supply: localSupply };
      
      if (node.id === 'node_jp_east') {
        demands = { requests: 120, supply: 25 };
      } else if (node.id === 'node_na_west') {
        demands = { requests: 62, supply: 12 };
      }

      const p: OutboundPayload = {
        nodeId: node.id,
        metaTrends: {},
        parentDemands: { [lineage]: demands },
        benchmarks: {}
      };

      return { payload: p, weight };
    });

    const aggregated = this.exchange.aggregateInbound(payloadsWithWeights);
    const aggDemand = aggregated.parentDemands[lineage] || { requests: 0, supply: 0 };

    return {
      lineage,
      requests: aggDemand.requests,
      supply: aggDemand.supply,
      shortageRisk: aggDemand.requests > aggDemand.supply * 4 ? 'HIGH' : 'MEDIUM'
    };
  }

  public getRegistry() {
    return this.registry;
  }

  public getTrustEngine() {
    return this.trustEngine;
  }

  public getExchange() {
    return this.exchange;
  }
}
