export enum ConfidenceLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NONE = 'none'
}

export enum KnowledgeSource {
  HANDBOOK = 'handbook',
  DATABASE = 'database',
  PUREDB = 'puredb',
  UMA_KNOWLEDGE = 'uma_knowledge',
  TAXONOMY = 'taxonomy',
  MEMORY = 'memory',
  META = 'meta',
  NONE = 'none'
}

export interface ResponseEvidence {
  source: KnowledgeSource;
  confidence: ConfidenceLevel;
}

export interface KnowledgeAnalysis {
  domain: string;
  source: KnowledgeSource;
  confidence: number;
  reasoning: string;
  evidence: ResponseEvidence;
}
