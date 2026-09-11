export const LogCategory = {
  SCHEDULER: 'Scheduler',
  PLANNER: 'Planner',
  CONTEXT: 'Context',
  TOOLS: 'Tools',
  MODELS: 'Models',
  VALIDATOR: 'Validator',
  CHECKPOINT: 'Checkpoint',
  TELEMETRY: 'Telemetry',
  RUNNER: 'AgentRunner',
} as const;

export type LogCategory = (typeof LogCategory)[keyof typeof LogCategory] | (string & {});

export type LogLevel =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'ERROR'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  traceId?: string;
  executionId?: string;
  layerId?: number | string;
  taskId?: string;
  durationMs?: number;
  data?: any;
  metadata?: Record<string, any>;
  error?: string;
  [key: string]: any;
}
