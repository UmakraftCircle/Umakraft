import { TaxonomyNode } from './taxonomy-loader.js';
import { TaxonomyIndex } from './taxonomy-index.js';
import { TaxonomyNormalizer } from './taxonomy-normalizer.js';

export interface TaxonomySearchOptions {
  category?: string;
  limit?: number;
  exactOnly?: boolean;
  minScore?: number;
}

export interface TaxonomySearchResult {
  node: TaxonomyNode;
  score: number;
  matchType: 'id' | 'official_name' | 'alias' | 'partial_name' | 'partial_alias' | 'fuzzy';
  matchedTerm: string;
}

export class TaxonomySearch {
  private index: TaxonomyIndex;

  constructor(index: TaxonomyIndex) {
    this.index = index;
  }

  /**
   * Finds a taxonomy node by exact ID (e.g. 'running_style.front_runner').
   */
  public findById(id: string): TaxonomyNode | undefined {
    if (!id) return undefined;
    return this.index.getById(id.trim());
  }

  /**
   * Finds a taxonomy node by official name (case-insensitive).
   */
  public findByName(name: string): TaxonomyNode | undefined {
    if (!name) return undefined;
    return this.index.getByName(name);
  }

  /**
   * Finds a taxonomy node by alias. Returns first matching node or undefined.
   */
  public findByAlias(alias: string): TaxonomyNode | undefined {
    if (!alias) return undefined;
    const matches = this.index.getByAlias(alias);
    return matches.length > 0 ? matches[0] : undefined;
  }

  /**
   * Finds all taxonomy nodes matching an alias.
   */
  public findAllByAlias(alias: string): TaxonomyNode[] {
    if (!alias) return [];
    return this.index.getByAlias(alias);
  }

  /**
   * Finds all taxonomy nodes belonging to a category (case-insensitive, normalized).
   */
  public findByCategory(category: string): TaxonomyNode[] {
    if (!category) return [];
    return this.index.getByCategory(category);
  }

  /**
   * Comprehensive search with ranking across ID, official name, aliases, and partial matches.
   */
  public search(query: string, options: TaxonomySearchOptions = {}): TaxonomySearchResult[] {
    const rawQuery = query?.trim();
    if (!rawQuery) return [];

    const normQuery = TaxonomyNormalizer.normalize(rawQuery);
    if (!normQuery) return [];

    const results: Map<string, TaxonomySearchResult> = new Map();
    const allNodes = options.category
      ? this.findByCategory(options.category)
      : this.index.getAll();

    for (const node of allNodes) {
      const normId = node.id.toLowerCase();
      const normName = TaxonomyNormalizer.normalize(node.name);

      // 1. Exact ID match (1.0)
      if (normId === normQuery || node.id === rawQuery) {
        this.addResult(results, {
          node,
          score: 1.0,
          matchType: 'id',
          matchedTerm: node.id
        });
        continue;
      }

      // 2. Exact Official Name match (1.0)
      if (normName === normQuery) {
        this.addResult(results, {
          node,
          score: 1.0,
          matchType: 'official_name',
          matchedTerm: node.name
        });
        continue;
      }

      // 3. Exact Alias match (0.95)
      let aliasMatched = false;
      for (const alias of node.aliases) {
        const normAlias = TaxonomyNormalizer.normalize(alias);
        if (normAlias === normQuery) {
          this.addResult(results, {
            node,
            score: 0.95,
            matchType: 'alias',
            matchedTerm: alias
          });
          aliasMatched = true;
          break;
        }
      }
      if (aliasMatched || options.exactOnly) continue;

      // 4. Partial / Substring match on official name (0.85)
      if (normName.includes(normQuery) || normQuery.includes(normName)) {
        this.addResult(results, {
          node,
          score: 0.85,
          matchType: 'partial_name',
          matchedTerm: node.name
        });
        continue;
      }

      // 5. Partial / Substring match on aliases (0.75)
      let partialAliasMatched = false;
      for (const alias of node.aliases) {
        const normAlias = TaxonomyNormalizer.normalize(alias);
        if (normAlias.includes(normQuery) || normQuery.includes(normAlias)) {
          this.addResult(results, {
            node,
            score: 0.75,
            matchType: 'partial_alias',
            matchedTerm: alias
          });
          partialAliasMatched = true;
          break;
        }
      }
      if (partialAliasMatched) continue;

      // 6. Token overlap / fuzzy match (0.60)
      const queryTokens = normQuery.split(' ').filter(t => t.length > 1);
      const nameTokens = normName.split(' ').filter(t => t.length > 1);
      const tokenMatch = queryTokens.some(qt => nameTokens.some(nt => nt.includes(qt) || qt.includes(nt)));
      if (tokenMatch) {
        this.addResult(results, {
          node,
          score: 0.60,
          matchType: 'fuzzy',
          matchedTerm: node.name
        });
      }
    }

    const minScore = options.minScore ?? 0.5;
    const sorted = Array.from(results.values())
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score);

    return options.limit && options.limit > 0 ? sorted.slice(0, options.limit) : sorted;
  }

  private addResult(results: Map<string, TaxonomySearchResult>, candidate: TaxonomySearchResult): void {
    const existing = results.get(candidate.node.id);
    if (!existing || candidate.score > existing.score) {
      results.set(candidate.node.id, candidate);
    }
  }
}
