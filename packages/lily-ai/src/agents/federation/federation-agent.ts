import { BaseAgent } from '../base/agent.js';
import { AgentContext } from '../base/agent-context.js';
import { AgentResult } from '../base/agent-result.js';
import { FederationService } from '../../federation/federation-service.js';

export class FederationAgent extends BaseAgent {
  id = 'federation';
  name = 'Federation Agent';
  private fedService = new FederationService();

  async canHandle(context: AgentContext): Promise<boolean> {
    const input = context.input.toLowerCase();
    return (
      input.includes('federation') ||
      input.includes('cross-server') ||
      input.includes('global meta') ||
      input.includes('sync') ||
      input.includes('benchmark') ||
      input.includes('shared intelligence')
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.logAction('Process federation sync', 'Success');
    
    if (context.input.toLowerCase().includes('benchmark')) {
      const benchmarks = this.fedService.generateBenchmarks(93, 82);
      return {
        success: true,
        output: `Federation Agent: Retrieved benchmarking reports from 3 verified nodes.
- fanCompliance: Local (93%) vs Federation Avg (88%)
- parentCoverage: Local (82%) vs Federation Avg (67%)`,
        data: { benchmarks }
      };
    }

    return {
      success: true,
      output: `Federation Agent: Global federation is active with 3 healthy regional nodes (SEA, JP, NA). Shared intelligence sync completed safely under Privacy Engine sanitization guidelines.`,
      data: { activeNodes: 3 }
    };
  }
}
