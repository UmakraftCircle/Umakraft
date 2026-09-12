import { AgentRegistry } from '../registry/agent-registry.js';
import { AgentRouter } from '../router/agent-router.js';
import { AgentContext } from '../base/agent-context.js';
import { AgentResult, AgentExecution } from '../base/agent-result.js';

export class Orchestrator {
  private executionLogs: AgentExecution[] = [];

  constructor(
    private registry: AgentRegistry,
    private router: AgentRouter
  ) {}

  public async execute(context: AgentContext): Promise<AgentResult> {
    const matchedAgents = await this.router.route(context);

    if (matchedAgents.length === 0) {
      return {
        success: false,
        output: "I'm not sure which specialist agent should handle this request."
      };
    }

    const outputs: string[] = [];
    const collectedData: any = {};
    let overallSuccess = true;

    for (const agent of matchedAgents) {
      const startTime = Date.now();
      try {
        const result = await agent.execute(context);
        const duration = Date.now() - startTime;

        this.executionLogs.push({
          agentId: agent.id,
          duration,
          success: result.success
        });

        if (result.success) {
          outputs.push(result.output);
          Object.assign(collectedData, result.data || {});
        } else {
          overallSuccess = false;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.executionLogs.push({
          agentId: agent.id,
          duration,
          success: false
        });
        overallSuccess = false;
      }
    }

    return {
      success: overallSuccess && matchedAgents.length > 0,
      output: outputs.join('\n\n'),
      data: collectedData
    };
  }

  public getExecutionLogs(): AgentExecution[] {
    return this.executionLogs;
  }
}
