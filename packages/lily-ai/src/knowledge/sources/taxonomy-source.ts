import { KnowledgeSource } from '../knowledge-source.js';
import { KnowledgeQuery } from '../knowledge-context.js';
import { KnowledgeResult } from '../knowledge-result.js';
import { TAXONOMY_DATA } from '../taxonomy/data.js';
import { TaxonomyEntity } from '../taxonomy/types.js';
import { TaxonomyKnowledgeProvider } from '../providers/taxonomy/index.js';

export class TaxonomyKnowledgeSource implements KnowledgeSource {
  public id = 'taxonomy';
  public name = 'Official Taxonomy';
  public type = 'taxonomy';
  public priority = 100; // Highest authority (100)

  private provider: TaxonomyKnowledgeProvider;
  private entities: TaxonomyEntity[];

  constructor(entities: TaxonomyEntity[] = TAXONOMY_DATA, provider?: TaxonomyKnowledgeProvider) {
    this.entities = entities;
    this.provider = provider || new TaxonomyKnowledgeProvider();
  }

  public getProvider(): TaxonomyKnowledgeProvider {
    return this.provider;
  }

  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    // Query provider for authoritative results
    const providerResults = await this.provider.query(query);
    if (providerResults.length > 0) {
      return providerResults;
    }

    // Fallback to in-memory entities if provider returned empty
    const rawTerm = query.term?.trim().toLowerCase();
    if (!rawTerm) return [];

    const results: KnowledgeResult[] = [];

    for (const entity of this.entities) {
      const canonicalLower = entity.canonical.toLowerCase();
      let matched = false;
      let confidence = 0.90;

      if (canonicalLower === rawTerm) {
        matched = true;
        confidence = 1.0;
      } else if (entity.aliases.some(a => a.toLowerCase() === rawTerm)) {
        matched = true;
        confidence = 0.98;
      } else if (canonicalLower.includes(rawTerm) || rawTerm.includes(canonicalLower)) {
        matched = true;
        confidence = 0.85;
      } else if (entity.aliases.some(a => a.toLowerCase().includes(rawTerm) || rawTerm.includes(a.toLowerCase()))) {
        matched = true;
        confidence = 0.80;
      }

      if (matched) {
        if (query.types && query.types.length > 0) {
          if (!query.types.includes(entity.type)) {
            continue;
          }
        }

        results.push({
          source: 'taxonomy',
          authority: this.priority,
          content: {
            id: entity.id,
            canonical: entity.canonical,
            type: entity.type,
            aliases: entity.aliases
          },
          confidence,
          metadata: {
            id: entity.id,
            canonical: entity.canonical,
            type: entity.type,
            category: entity.type,
            domain: 'Umamusume'
          }
        });
      }
    }

    return results;
  }
}

