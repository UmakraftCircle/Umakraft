import { LanguageAnalysis } from '../language/language-analysis.js';
import { KnowledgeAnalysis } from './knowledge-analysis.js';

export interface IKnowledgeService {
  analyze(languageAnalysis: LanguageAnalysis): KnowledgeAnalysis;
}

export * from './knowledge-analysis.js';
export * from './knowledge-classifier.js';
export * from './source-registry.js';
export * from './knowledge-context.js';
export * from './lily-knowledge-service.js';
