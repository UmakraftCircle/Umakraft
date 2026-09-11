import { ToolDefinition } from '@ai-agent-platform/shared';
import { deepResearchTool, questionReviewTool } from './research.js';
import { browserExtractTool } from './browser-extract.js';
import { errorHandlingPatternsTool } from './error-handling.js';
import {
  skillComplyTool,
  agentEvalTool,
  benchmarkTool,
  agenticEngineeringTool,
  contextEngineeringTool,
  contextManagerTool,
  compressionStrategyTool,
  iterativeRetrievalTool,
  aiPromptTool,
  continuousLearningInstinctsTool,
} from './guidance.js';

export const allSkillTools: ToolDefinition[] = [
  deepResearchTool,
  questionReviewTool,
  browserExtractTool,
  errorHandlingPatternsTool,
  skillComplyTool,
  agentEvalTool,
  benchmarkTool,
  agenticEngineeringTool,
  contextEngineeringTool,
  contextManagerTool,
  compressionStrategyTool,
  iterativeRetrievalTool,
  aiPromptTool,
  continuousLearningInstinctsTool,
];

export {
  deepResearchTool,
  questionReviewTool,
  browserExtractTool,
  errorHandlingPatternsTool,
  skillComplyTool,
  agentEvalTool,
  benchmarkTool,
  agenticEngineeringTool,
  contextEngineeringTool,
  contextManagerTool,
  compressionStrategyTool,
  iterativeRetrievalTool,
  aiPromptTool,
  continuousLearningInstinctsTool,
};
