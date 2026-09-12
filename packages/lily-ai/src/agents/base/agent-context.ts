export enum AgentPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW'
}

export interface SharedAgentContext {
  trainerId?: string;
  guildId?: string;
  character?: string;
  race?: string;
  activeBuild?: string;
}

export interface AgentContext {
  input: string;
  shared: SharedAgentContext;
  priority?: AgentPriority;
}
