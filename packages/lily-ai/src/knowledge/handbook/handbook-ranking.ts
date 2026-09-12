import { HandbookDocument, HandbookSearchResult } from './handbook-types.js';

export interface RankingContext {
  taxonomyMatches?: string[];
  semanticTokens?: string[];
  category?: string;
  tags?: string[];
}

export class HandbookRankingEngine {
  private sourceAuthorityWeights: Record<string, number> = {
    'Official Umamusume Data': 1.0,
    'Umakraft Documentation': 0.98,
    'Club Policies': 0.95,
    'System Documentation': 0.95,
    'Curated Guides': 0.90,
    'Community Guides': 0.70
  };

  public rank(
    doc: HandbookDocument,
    rawQuery: string,
    context?: RankingContext
  ): HandbookSearchResult {
    const query = rawQuery.trim().toLowerCase();
    const docTitleLower = doc.title.toLowerCase();
    const docContentLower = doc.content.toLowerCase();

    let score = 0;
    const matchReasons: string[] = [];
    const matchedTags: string[] = [];

    // 1. Exact / Substring Title Match
    if (docTitleLower === query) {
      score += 12;
      matchReasons.push('Exact title match');
    } else if (docTitleLower.includes(query)) {
      score += 8;
      matchReasons.push('Substring title match');
    }

    // 2. Taxonomy Context Match
    if (context?.taxonomyMatches && doc.taxonomyIds) {
      for (const tax of context.taxonomyMatches) {
        const taxLower = tax.toLowerCase();
        if (doc.taxonomyIds.some(t => t.toLowerCase().includes(taxLower) || taxLower.includes(t.toLowerCase()))) {
          score += 8;
          matchReasons.push(`Taxonomy entity matched: ${tax}`);
        }
      }
    }

    // 3. Tag Match
    const queryWords = query.split(/[^a-z0-9_-]+/i).filter(w => w.length > 2);
    for (const tag of doc.tags) {
      const tagLower = tag.toLowerCase();
      if (query.includes(tagLower) || queryWords.includes(tagLower)) {
        score += 4;
        matchedTags.push(tag);
        matchReasons.push(`Tag matched: ${tag}`);
      }
    }

    // 4. Semantic Token Overlap
    if (context?.semanticTokens) {
      for (const token of context.semanticTokens) {
        const tokenLower = token.toLowerCase();
        if (docTitleLower.includes(tokenLower)) {
          score += 3;
          matchReasons.push(`Semantic token in title: ${token}`);
        } else if (docContentLower.includes(tokenLower)) {
          score += 1.5;
        }
      }
    } else {
      for (const word of queryWords) {
        if (docContentLower.includes(word)) {
          score += 1.0;
        }
      }
    }

    // 5. Category Match
    if (context?.category && doc.category.toLowerCase() === context.category.toLowerCase()) {
      score += 3;
      matchReasons.push(`Category match: ${doc.category}`);
    }

    // 6. Authority Weight Multiplier
    const authorityMultiplier = this.sourceAuthorityWeights[doc.source] || 0.85;
    score *= authorityMultiplier;

    // 7. Deprecation Penalty
    if (doc.deprecated) {
      score *= 0.3;
      matchReasons.push('Deprecated document penalty');
    }

    // Calculate normalized confidence [0.1, 1.0]
    const confidence = Math.min(1.0, Math.max(0.1, Number((score / 15).toFixed(2))));

    return {
      document: doc,
      score: Number(score.toFixed(2)),
      confidence,
      matchedTags,
      matchReasons
    };
  }
}
