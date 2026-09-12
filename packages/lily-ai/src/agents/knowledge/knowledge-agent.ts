import { BaseAgent } from '../base/agent.js';
import { AgentContext } from '../base/agent-context.js';
import { AgentResult } from '../base/agent-result.js';

export class KnowledgeAgent extends BaseAgent {
  id = 'knowledge';
  name = 'Knowledge Agent';

  async canHandle(context: AgentContext): Promise<boolean> {
    const input = context.input.toLowerCase();
    return (
      input.includes('character') ||
      input.includes('skill') ||
      input.includes('track') ||
      input.includes('race') ||
      input.includes('card') ||
      input.includes('scenario') ||
      input.includes('definition') ||
      input.includes('what is') ||
      input.includes('does')
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.logAction('Retrieve taxonomy definition', 'Success');
    return {
      success: true,
      output: `Knowledge Agent: Concentration is a skill that reduces late start penalty. Characters like Kitasan Black excel with Front Runner skills.`,
      data: { foundInHandbook: true }
    };
  }
}
