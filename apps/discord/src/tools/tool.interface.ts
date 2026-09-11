import { IntentType } from '../intent-router.js';

export interface ToolContext {
  trainerId: string;
  query: string;
  intent: IntentType;
  additionalData?: Record<string, any>;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  data: any;
  durationMs: number;
  error?: string;
}

export interface Tool {
  getName(): string;
  execute(context: ToolContext): ToolResult;
}
