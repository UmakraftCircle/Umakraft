import { KnowledgeAnalysis } from './knowledge-analysis.js';

export interface KnowledgeContext {
  analysis: KnowledgeAnalysis;
  query: string;
}
