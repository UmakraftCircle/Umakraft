import { LilyAIRequest } from '../../core/types.js';
import { LanguageAnalysis } from '../language/language-analysis.js';
import { MemoryContext } from '../memory/memory-context.js';
import { KnowledgeAnalysis } from '../knowledge/knowledge-analysis.js';
import { ToolResult } from '../tools/tool-result.js';

export interface LilyChatContext {
  request: LilyAIRequest;
  language: LanguageAnalysis;
  memory: MemoryContext;
  knowledge?: KnowledgeAnalysis;
  toolResult?: ToolResult;
  selectedTool?: string;
}
