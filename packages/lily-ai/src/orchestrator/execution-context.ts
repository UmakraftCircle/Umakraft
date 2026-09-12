import { LilyAIRequest } from '../core/types.js';
import { LanguageAnalysis } from '../services/language/language-analysis.js';
import { MemoryContext } from '../services/memory/memory-context.js';
import { KnowledgeAnalysis } from '../services/knowledge/knowledge-analysis.js';
import { ToolResult } from '../services/tools/tool-result.js';

export interface LilyExecutionContext {
  request: LilyAIRequest;
  language?: LanguageAnalysis;
  memory?: MemoryContext;
  knowledge?: KnowledgeAnalysis;
  selectedTool?: string;
  toolResult?: ToolResult;
  response?: string;
}
