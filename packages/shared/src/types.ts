export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentTask {
  id: string;
  name: string;
  toolSlug: string;
  arguments: Record<string, any>;
  dependencies: string[]; // IDs of tasks that must complete first
  status: TaskStatus;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface ExecutionPlan {
  id: string;
  intent: string;
  tasks: Map<string, AgentTask>; // Maps task ID -> AgentTask
  metadata: {
    modelUsed: string;
    createdAt: string;
    estimatedSteps: number;
  };
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  slug: string;
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  handler: (args: Record<string, any>) => Promise<any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
