import { BaseAgent } from '../base/agent.js';
import { AgentContext } from '../base/agent-context.js';
import { AgentResult } from '../base/agent-result.js';

export class OperationsAgent extends BaseAgent {
  id = 'operations';
  name = 'Operations Agent';

  async canHandle(context: AgentContext): Promise<boolean> {
    const input = context.input.toLowerCase();
    return (
      input.includes('link') ||
      input.includes('membership') ||
      input.includes('admin') ||
      input.includes('request') ||
      input.includes('workflow') ||
      input.includes('automation')
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.logAction('Process operations request', 'Success');
    return {
      success: true,
      output: `Operations Agent: Processed administrative request. There are 2 pending link requests awaiting review.`,
      data: { pendingLinkRequests: 2 }
    };
  }
}
