export interface KnowledgeResult {
  source: string;
  authority: number;
  content: unknown;
  confidence: number;
  metadata?: Record<string, unknown>;
}
