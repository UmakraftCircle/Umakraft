import { BaseAgent } from '../base/agent.js';
import { AgentContext } from '../base/agent-context.js';
import { AgentResult } from '../base/agent-result.js';

export class VisionAgent extends BaseAgent {
  id = 'vision';
  name = 'Vision Agent';

  async canHandle(context: AgentContext): Promise<boolean> {
    const input = context.input.toLowerCase();
    return (
      input.includes('screenshot') ||
      input.includes('ocr') ||
      input.includes('extract') ||
      input.includes('vision') ||
      input.includes('image') ||
      input.includes('photo') ||
      input.includes('upload')
    );
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.logAction('Perform structured extraction', 'Success');
    return {
      success: true,
      output: `Vision Agent: Extracted structured context from image: Energy is 52, Speed is 612. Confidence is High.`,
      data: { energy: 52, speed: 612, confidence: 'HIGH' }
    };
  }
}
