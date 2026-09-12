import { TaxonomyNode } from './taxonomy-loader.js';
import { TaxonomyIndex } from './taxonomy-index.js';
import { TaxonomyNormalizer } from './taxonomy-normalizer.js';

export interface AliasResolutionResult {
  officialName: string;
  id?: string;
  category?: string;
  node?: TaxonomyNode;
  alias: string;
  isOfficial: boolean;
}

export class TaxonomyAliasResolver {
  private index: TaxonomyIndex;

  constructor(index: TaxonomyIndex) {
    this.index = index;
  }

  /**
   * Resolves an alias or term to its official canonical name.
   * Rule: Official name always wins!
   * Examples:
   * "nige" -> { officialName: "Front Runner" }
   * "senkou" -> { officialName: "Pace Chaser" }
   */
  public resolve(term: string): AliasResolutionResult | undefined {
    const raw = term?.trim();
    if (!raw) return undefined;

    const normalized = TaxonomyNormalizer.normalize(raw);
    if (!normalized) return undefined;

    // 1. Official Name Enforcement: check if term is already an official name
    const exactNameMatch = this.index.getByName(raw);
    if (exactNameMatch) {
      return {
        officialName: exactNameMatch.name,
        id: exactNameMatch.id,
        category: exactNameMatch.category,
        node: exactNameMatch,
        alias: raw,
        isOfficial: true
      };
    }

    // 2. Look up in alias index
    const aliasMatches = this.index.getByAlias(raw);
    if (aliasMatches.length > 0) {
      const top = aliasMatches[0];
      return {
        officialName: top.name,
        id: top.id,
        category: top.category,
        node: top,
        alias: raw,
        isOfficial: false
      };
    }

    // 3. Fallback: check if raw matches any node alias directly
    for (const node of this.index.getAll()) {
      if (node.aliases.some(a => TaxonomyNormalizer.normalize(a) === normalized)) {
        return {
          officialName: node.name,
          id: node.id,
          category: node.category,
          node,
          alias: raw,
          isOfficial: false
        };
      }
    }

    return undefined;
  }
}
