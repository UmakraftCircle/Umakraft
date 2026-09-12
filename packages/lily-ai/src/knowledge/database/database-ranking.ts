import { DatabaseKnowledgeResult } from './database-result.js';

export interface DatabaseScoredResult {
  result: DatabaseKnowledgeResult;
  score: number;
  matchReasons: string[];
}

export class DatabaseRankingEngine {
  public rank(
    results: DatabaseKnowledgeResult[],
    searchTerm?: string,
    preferredEntityType?: string
  ): DatabaseKnowledgeResult[] {
    if (results.length <= 1) return results;

    const scored = results.map(res => this.scoreResult(res, searchTerm, preferredEntityType));
    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.result);
  }

  public scoreResult(
    result: DatabaseKnowledgeResult,
    searchTerm?: string,
    preferredEntityType?: string
  ): DatabaseScoredResult {
    let score = result.confidence * 50; // Base 0-50 from confidence
    const matchReasons: string[] = [`Base confidence (${result.confidence})`];

    // Entity type preference
    if (preferredEntityType && result.entityType === preferredEntityType) {
      score += 25;
      matchReasons.push(`Matches requested entity type: ${preferredEntityType}`);
    }

    // Term matching
    if (searchTerm) {
      const termLower = searchTerm.trim().toLowerCase();
      const entityIdLower = result.entityId.toLowerCase();

      if (entityIdLower === termLower) {
        score += 30;
        matchReasons.push('Exact entity ID match');
      } else if (entityIdLower.includes(termLower) || termLower.includes(entityIdLower)) {
        score += 15;
        matchReasons.push('Partial entity ID match');
      }

      // Metadata string matching (e.g. trainerName, clubName)
      if (result.metadata) {
        const name = (result.metadata.trainerName || result.metadata.name || result.metadata.clubName) as string;
        if (name) {
          const nameLower = name.toLowerCase();
          if (nameLower === termLower) {
            score += 30;
            matchReasons.push(`Exact name match: ${name}`);
          } else if (nameLower.includes(termLower) || termLower.includes(nameLower)) {
            score += 15;
            matchReasons.push(`Partial name match: ${name}`);
          }
        }
      }
    }

    // Recency boost (within 5 minutes)
    const ageMs = Date.now() - result.timestamp.getTime();
    if (ageMs < 300_000) {
      score += 5;
      matchReasons.push('Fresh data boost');
    }

    return {
      result,
      score,
      matchReasons
    };
  }
}
