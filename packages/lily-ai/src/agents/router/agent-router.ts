import { AgentRegistry } from '../registry/agent-registry.js';
import { AgentContext } from '../base/agent-context.js';
import { LilyAgent } from '../base/agent.js';

export class AgentRouter {
  constructor(private registry: AgentRegistry) {}

  public async route(context: AgentContext): Promise<LilyAgent[]> {
    const matched: LilyAgent[] = [];
    for (const agent of this.registry.getAll()) {
      if (await agent.canHandle(context)) {
        matched.push(agent);
      }
    }
    return matched;
  }
}
