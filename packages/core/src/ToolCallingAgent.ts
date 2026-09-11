/**
 * ToolCallingAgent — Unified deterministic tool-execution control loop.
 *
 * Re-exports the unified ToolCallingAgent implementation from tool-calling-agent.js
 * while providing full backward compatibility for reference types.
 */

export * from './tool-calling-agent.js';

export interface ToolSpec<TArgs = Record<string, unknown>> {
  slug: string;
  name: string;
  description?: string;
  handler: (args: TArgs) => Promise<string> | string;
}

export interface ToolCallingAgentConfig {
  maxToolCalls: number;
  toolBudgets: Record<string, number>;
  defaultBudget: number;
  stopShortBy: number;
  finalizeSystemMessage: string;
}

export type ChatMessage =
  | { role: 'system' | 'assistant' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls: import('./tool-calling-agent.js').ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface RunResult {
  content: string;
  finalizeReason: import('./tool-calling-agent.js').FinalizeReason | null;
  totalToolCalls: number;
  log: import('./tool-calling-agent.js').StructuredLogEntry[];
}
