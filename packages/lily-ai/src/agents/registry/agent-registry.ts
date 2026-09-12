import { LilyAgent } from '../base/agent.js';

export class AgentRegistry {
  private agents = new Map<string, LilyAgent>();

  public register(agent: LilyAgent): void {
    this.agents.set(agent.id, agent);
  }

  public get(agentId: string): LilyAgent | undefined {
    return this.agents.get(agentId);
  }

  public getAll(): LilyAgent[] {
    return Array.from(this.agents.values());
  }
}
