import { KnowledgeSource } from '../knowledge-source.js';
import { KnowledgeQuery } from '../knowledge-context.js';
import { KnowledgeResult } from '../knowledge-result.js';
import { GlossaryService } from '../../language-core/glossary/glossary-service.js';

export class GlossaryKnowledgeSource implements KnowledgeSource {
  public id = 'glossary';
  public name = 'Official Glossary';
  public type = 'glossary';
  public priority = 65; // Authority: 65

  private glossaryService: GlossaryService;

  constructor(glossaryService?: GlossaryService) {
    this.glossaryService = glossaryService || new GlossaryService();
  }

  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const rawTerm = query.term.trim().toLowerCase();
    if (!rawTerm) return [];

    const results: KnowledgeResult[] = [];

    // Direct lookup
    const direct = this.glossaryService.lookup(rawTerm);
    if (direct) {
      results.push({
        source: 'glossary',
        authority: this.priority,
        content: direct,
        confidence: 0.95,
        metadata: {
          term: direct.term,
          domain: direct.domain,
          category: direct.type
        }
      });
    }

    // Search matches
    const searchMatches = this.glossaryService.search().searchTerm(rawTerm);
    for (const match of searchMatches) {
      if (!results.some(r => (r.content as any)?.term?.toLowerCase() === match.term.toLowerCase())) {
        results.push({
          source: 'glossary',
          authority: this.priority,
          content: match,
          confidence: 0.85,
          metadata: {
            term: match.term,
            domain: match.domain,
            category: match.type
          }
        });
      }
    }

    return results;
  }
}
