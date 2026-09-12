import { KnowledgeQuery } from './knowledge-context.js';
import { KnowledgeResult } from './knowledge-result.js';

export type KnowledgeSourceType =
  | 'taxonomy'
  | 'glossary'
  | 'dictionary'
  | 'handbook'
  | 'database'
  | 'static_documents'
  | 'generated_knowledge'
  | 'future_apis'
  | string;

export interface KnowledgeSource {
  id: string;
  name: string;
  type: KnowledgeSourceType;
  priority: number; // Higher number = higher authority
  query(query: KnowledgeQuery): Promise<KnowledgeResult[]>;
}
