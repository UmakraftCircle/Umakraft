import { KnowledgeSource } from '../knowledge-source.js';
import { KnowledgeQuery } from '../knowledge-context.js';
import { KnowledgeResult } from '../knowledge-result.js';
import { searchHandbook } from '../handbook/handbook-search.js';

export class HandbookKnowledgeSource implements KnowledgeSource {
  public id = 'handbook';
  public name = 'Official Handbook';
  public type = 'handbook';
  public priority = 75; // Authority: 75

  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const rawTerm = query.term.trim();
    if (!rawTerm) return [];

    const searchResults = searchHandbook(rawTerm);
    return searchResults.map(entry => ({
      source: 'handbook',
      authority: this.priority,
      content: {
        title: entry.title,
        section: entry.section,
        content: entry.content
      },
      confidence: entry.confidence,
      metadata: {
        title: entry.title,
        section: entry.section,
        category: 'club_handbook',
        domain: 'Club'
      }
    }));
  }
}
