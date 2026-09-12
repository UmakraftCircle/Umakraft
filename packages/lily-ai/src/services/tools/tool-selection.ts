import { LanguageAnalysis } from '../language/language-analysis.js';
import { ToolResult } from './tool-result.js';

export interface ToolSelection {
  tool: string | null;
}

export interface ToolExecutionContext {
  trainerId?: string;
  trainerName?: string;
  userId?: string;
  username?: string;
  language?: LanguageAnalysis;
  memory?: any;
}

export interface LilyTool {
  name: string;
  canHandle(analysis: LanguageAnalysis): boolean;
  execute?(context: ToolExecutionContext): Promise<ToolResult> | ToolResult;
}
