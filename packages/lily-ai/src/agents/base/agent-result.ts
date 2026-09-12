export interface AgentMemory {
  recentActions: string[];
  recentResults: string[];
}

export interface AgentResult {
  success: boolean;
  output: string;
  data?: any;
  collaborateWith?: string[]; // IDs of agents to collaborate with or chain
}

export interface AgentExecution {
  agentId: string;
  duration: number;
  success: boolean;
}
