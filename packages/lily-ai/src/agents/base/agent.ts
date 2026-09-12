import { AgentContext } from './agent-context.js';
import { AgentResult, AgentMemory } from './agent-result.js';

export interface LilyAgent {
  id: string;
  name: string;
  memory: AgentMemory;
  canHandle(context: AgentContext): Promise<boolean>;
  execute(context: AgentContext): Promise<AgentResult>;
}

export abstract class BaseAgent implements LilyAgent {
  abstract id: string;
  abstract name: string;
  memory: AgentMemory = {
    recentActions: [],
    recentResults: []
  };

  abstract canHandle(context: AgentContext): Promise<boolean>;
  abstract execute(context: AgentContext): Promise<AgentResult>;

  protected logAction(action: string, result: string) {
    this.memory.recentActions.push(action);
    this.memory.recentResults.push(result);
    if (this.memory.recentActions.length > 10) {
      this.memory.recentActions.shift();
      this.memory.recentResults.shift();
    }
  }
}
