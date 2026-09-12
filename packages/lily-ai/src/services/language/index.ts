import { LanguageAnalysis } from './language-analysis.js';

export interface ILanguageService {
  analyze(message: string): LanguageAnalysis;
}

export * from './language-analysis.js';
export * from './lily-language-service.js';
export * from './intent-detector.js';
export * from './taxonomy-resolver.js';
export * from './entity-extractor.js';
