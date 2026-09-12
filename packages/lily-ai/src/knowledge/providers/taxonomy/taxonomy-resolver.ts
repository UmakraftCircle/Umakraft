import { TaxonomyNode } from './taxonomy-loader.js';
import { TaxonomySearch } from './taxonomy-search.js';
import { TaxonomyAliasResolver } from './taxonomy-alias.js';
import { TaxonomyNormalizer } from './taxonomy-normalizer.js';

export interface TaxonomyResolveContext {
  category?: string;
  intent?: string;
  recentEntities?: string[];
  maxMatches?: number;
}

export interface TaxonomyResolveResult {
  ambiguous: boolean;
  id?: string;
  name?: string;
  officialName?: string;
  category?: string;
  node?: TaxonomyNode;
  matches?: string[];
  candidateNodes?: TaxonomyNode[];
}

export class TaxonomyResolver {
  private searchEngine: TaxonomySearch;
  private aliasResolver: TaxonomyAliasResolver;

  constructor(searchEngine: TaxonomySearch, aliasResolver: TaxonomyAliasResolver) {
    this.searchEngine = searchEngine;
    this.aliasResolver = aliasResolver;
  }

  /**
   * Resolves an input query into an unambiguous taxonomy entity or an ambiguous match set.
   * Directly integrates with F7.5C Top Match Clarification.
   */
  public resolve(input: string, context?: TaxonomyResolveContext): TaxonomyResolveResult {
    const raw = input?.trim();
    if (!raw) {
      return { ambiguous: false };
    }

    // 1. Direct ID match
    const directId = this.searchEngine.findById(raw);
    if (directId) {
      return {
        ambiguous: false,
        id: directId.id,
        name: directId.name,
        officialName: directId.name,
        category: directId.category,
        node: directId
      };
    }

    // 2. Exact Official Name match (Official name always wins!)
    const exactName = this.searchEngine.findByName(raw);
    if (exactName) {
      if (!context?.category || TaxonomyNormalizer.normalizeCategory(exactName.category) === TaxonomyNormalizer.normalizeCategory(context.category)) {
        return {
          ambiguous: false,
          id: exactName.id,
          name: exactName.name,
          officialName: exactName.name,
          category: exactName.category,
          node: exactName
        };
      }
    }

    // 3. Exact alias resolution
    const allWithAlias = this.searchEngine.findAllByAlias(raw);
    if (allWithAlias.length > 1) {
      if (context?.category) {
        const catFiltered = allWithAlias.filter(
          n => TaxonomyNormalizer.normalizeCategory(n.category) === TaxonomyNormalizer.normalizeCategory(context.category!)
        );
        if (catFiltered.length === 1) {
          const single = catFiltered[0];
          return {
            ambiguous: false,
            id: single.id,
            name: single.name,
            officialName: single.name,
            category: single.category,
            node: single
          };
        }
      }

      const distinctNames = Array.from(new Set(allWithAlias.map(n => n.name)));
      return {
        ambiguous: true,
        matches: distinctNames,
        candidateNodes: allWithAlias
      };
    } else if (allWithAlias.length === 1) {
      const aliasRes = allWithAlias[0];
      if (!context?.category || TaxonomyNormalizer.normalizeCategory(aliasRes.category) === TaxonomyNormalizer.normalizeCategory(context.category)) {
        return {
          ambiguous: false,
          id: aliasRes.id,
          name: aliasRes.name,
          officialName: aliasRes.name,
          category: aliasRes.category,
          node: aliasRes
        };
      }
    }

    // 4. Multi-match search & ambiguity analysis
    const searchResults = this.searchEngine.search(raw, {
      category: context?.category,
      limit: context?.maxMatches ?? 5
    });

    if (searchResults.length === 0) {
      return { ambiguous: false };
    }

    if (searchResults.length === 1) {
      const top = searchResults[0].node;
      return {
        ambiguous: false,
        id: top.id,
        name: top.name,
        officialName: top.name,
        category: top.category,
        node: top
      };
    }

    // Multiple matches: check if top match dominates significantly
    const top = searchResults[0];
    const second = searchResults[1];

    // If top score is 1.0 and second is significantly lower (< 0.90)
    if (top.score === 1.0 && second.score < 0.90) {
      return {
        ambiguous: false,
        id: top.node.id,
        name: top.node.name,
        officialName: top.node.name,
        category: top.node.category,
        node: top.node
      };
    }

    // Top matches are close -> AMBIGUOUS
    // Collect distinct candidate names
    const distinctMatches: string[] = [];
    const candidateNodes: TaxonomyNode[] = [];

    for (const res of searchResults) {
      if (!distinctMatches.includes(res.node.name)) {
        distinctMatches.push(res.node.name);
        candidateNodes.push(res.node);
      }
    }

    if (distinctMatches.length === 1) {
      const single = candidateNodes[0];
      return {
        ambiguous: false,
        id: single.id,
        name: single.name,
        officialName: single.name,
        category: single.category,
        node: single
      };
    }

    return {
      ambiguous: true,
      matches: distinctMatches,
      candidateNodes
    };
  }
}
