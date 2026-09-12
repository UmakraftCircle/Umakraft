export * from './handbook-types.js';

export interface HandbookResult {
  section?: string;
  title: string;
  content: string;
  confidence: number;
  category?: string;
  tags?: string[];
  version?: string;
  recommendations?: string[];
}

