import { TaxonomyNode, TaxonomyRegistry } from './taxonomy-loader.js';
import { TaxonomyNormalizer } from './taxonomy-normalizer.js';

export class TaxonomyIndex {
  private idIndex = new Map<string, TaxonomyNode>();
  private nameIndex = new Map<string, TaxonomyNode>();
  private aliasIndex = new Map<string, TaxonomyNode[]>();
  private categoryIndex = new Map<string, TaxonomyNode[]>();

  constructor(registry: TaxonomyRegistry) {
    this.rebuild(registry);
  }

  /**
   * Rebuilds all index maps from the given TaxonomyRegistry.
   */
  public rebuild(registry: TaxonomyRegistry): void {
    this.idIndex.clear();
    this.nameIndex.clear();
    this.aliasIndex.clear();
    this.categoryIndex.clear();

    for (const node of registry.getAll()) {
      // Index by ID
      this.idIndex.set(node.id, node);

      // Index by Official Name
      const normalizedName = TaxonomyNormalizer.normalize(node.name);
      if (normalizedName) {
        this.nameIndex.set(normalizedName, node);
      }

      // Index by Category
      const catKey = TaxonomyNormalizer.normalizeCategory(node.category);
      if (catKey) {
        if (!this.categoryIndex.has(catKey)) {
          this.categoryIndex.set(catKey, []);
        }
        this.categoryIndex.get(catKey)!.push(node);
      }

      // Index by Aliases
      for (const alias of node.aliases) {
        const normalizedAlias = TaxonomyNormalizer.normalize(alias);
        if (!normalizedAlias) continue;

        if (!this.aliasIndex.has(normalizedAlias)) {
          this.aliasIndex.set(normalizedAlias, []);
        }
        const existing = this.aliasIndex.get(normalizedAlias)!;
        if (!existing.some(n => n.id === node.id)) {
          existing.push(node);
        }
      }
    }
  }

  public getById(id: string): TaxonomyNode | undefined {
    return this.idIndex.get(id);
  }

  public getByName(name: string): TaxonomyNode | undefined {
    return this.nameIndex.get(TaxonomyNormalizer.normalize(name));
  }

  public getByAlias(alias: string): TaxonomyNode[] {
    return this.aliasIndex.get(TaxonomyNormalizer.normalize(alias)) || [];
  }

  public getByCategory(category: string): TaxonomyNode[] {
    return this.categoryIndex.get(TaxonomyNormalizer.normalizeCategory(category)) || [];
  }

  public getAll(): TaxonomyNode[] {
    return Array.from(this.idIndex.values());
  }
}
