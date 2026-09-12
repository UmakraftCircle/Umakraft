import { BaseAgent } from '../base/agent.js';
import { AgentContext } from '../base/agent-context.js';
import { AgentResult } from '../base/agent-result.js';

export class CoachAgent extends BaseAgent {
  id = 'coach';
  name = 'Coach Agent';

  async canHandle(context: AgentContext): Promise<boolean> {
    const input = context.input.toLowerCase();
    return (
      input.includes('build') ||
      input.includes('training') ||
      input.includes('career') ||
      input.includes('event') ||
      input.includes('skill') ||
      input.includes('how to') ||
      input.includes('plan')
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.logAction('Analyze coaching advice', 'Success');
    const character = context.shared.character || 'your character';
    return {
      success: true,
      output: `Coach Agent recommendation: For ${character}, prioritize Speed and Stamina in training. Prepare a Speed-focused build for long distances.`,
      data: { adviceType: 'build' }
    };
  }
}
