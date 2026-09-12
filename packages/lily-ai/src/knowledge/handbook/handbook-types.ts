export interface HandbookDocument {
  id: string;
  title: string;
  category: HandbookCategory | string;
  tags: string[];
  content: string;
  source: string;
  version: string;
  updatedAt: Date;
  createdAt?: Date;
  deprecated?: boolean;
  author?: string;
  summary?: string;
  recommendations?: string[];
  prerequisites?: string[];
  relatedDocumentIds?: string[];
  taxonomyIds?: string[];
  metadata?: Record<string, unknown>;
}

export type HandbookCategory =
  | 'Characters'
  | 'Running Styles'
  | 'Skills'
  | 'Support Cards'
  | 'Training'
  | 'Races'
  | 'Tracks'
  | 'Club Systems'
  | 'Fan Systems'
  | 'Linking Systems'
  | 'Bot Features';

export interface HandbookSearchOptions {
  category?: HandbookCategory | string;
  tags?: string[];
  minConfidence?: number;
  limit?: number;
  includeDeprecated?: boolean;
  taxonomyContext?: string[];
}

export interface HandbookSearchResult {
  document: HandbookDocument;
  score: number;
  confidence: number;
  matchedTags: string[];
  matchReasons: string[];
}

export interface HandbookRecommendationResult {
  primaryGuide?: HandbookDocument;
  relatedGuides: HandbookDocument[];
  recommendations: string[];
  confidence: number;
}
