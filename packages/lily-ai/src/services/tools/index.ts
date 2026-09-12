import { LanguageAnalysis } from '../language/language-analysis.js';
import { ToolSelection, ToolExecutionContext } from './tool-selection.js';
import { ToolResult } from './tool-result.js';

export interface IToolService {
  selectTool(analysis: LanguageAnalysis): ToolSelection;
  executeTool?(toolName: string, context: ToolExecutionContext): Promise<ToolResult>;
}

export * from './tool-selection.js';
export * from './tool-registry.js';
export * from './tool-result.js';
export * from './lily-tool-service.js';
