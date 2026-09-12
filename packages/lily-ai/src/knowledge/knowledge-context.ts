export interface KnowledgeContext {
  intent?: string;
  domain?: string;
  category?: string;
  userGoal?: string;
  activeScreen?: string;
  recentEntities?: string[];
  attributes?: Record<string, unknown>;
}

export interface KnowledgeQuery {
  term: string;
  context?: KnowledgeContext;
  maxResults?: number;
  types?: string[];
}
