import { HandbookDocument, HandbookCategory } from './handbook-types.js';

export class HandbookIndexer {
  private idMap = new Map<string, HandbookDocument>();
  private titleMap = new Map<string, HandbookDocument>();
  private categoryMap = new Map<string, Set<string>>();
  private tagMap = new Map<string, Set<string>>();
  private taxonomyMap = new Map<string, Set<string>>();
  private tokenIndex = new Map<string, Set<string>>();

  public index(doc: HandbookDocument): void {
    this.idMap.set(doc.id, doc);
    this.titleMap.set(doc.title.trim().toLowerCase(), doc);

    // Index category
    const cat = doc.category.toLowerCase();
    if (!this.categoryMap.has(cat)) {
      this.categoryMap.set(cat, new Set());
    }
    this.categoryMap.get(cat)!.add(doc.id);

    // Index tags
    for (const tag of doc.tags) {
      const normalizedTag = tag.trim().toLowerCase();
      if (!this.tagMap.has(normalizedTag)) {
        this.tagMap.set(normalizedTag, new Set());
      }
      this.tagMap.get(normalizedTag)!.add(doc.id);
    }

    // Index taxonomy IDs
    if (doc.taxonomyIds) {
      for (const taxId of doc.taxonomyIds) {
        const normTaxId = taxId.trim().toLowerCase();
        if (!this.taxonomyMap.has(normTaxId)) {
          this.taxonomyMap.set(normTaxId, new Set());
        }
        this.taxonomyMap.get(normTaxId)!.add(doc.id);
      }
    }

    // Index full-text tokens (title, content, recommendations)
    const textToTokenize = `${doc.title} ${doc.content} ${(doc.recommendations || []).join(' ')} ${doc.tags.join(' ')}`;
    const tokens = this.tokenize(textToTokenize);

    for (const token of tokens) {
      if (!this.tokenIndex.has(token)) {
        this.tokenIndex.set(token, new Set());
      }
      this.tokenIndex.get(token)!.add(doc.id);
    }
  }

  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9_-]+/i)
      .filter(t => t.length > 2);
  }

  public getById(id: string): HandbookDocument | undefined {
    return this.idMap.get(id);
  }

  public getByTitle(title: string): HandbookDocument | undefined {
    return this.titleMap.get(title.trim().toLowerCase());
  }

  public getByCategory(category: HandbookCategory | string): HandbookDocument[] {
    const ids = this.categoryMap.get(category.toLowerCase());
    if (!ids) return [];
    return Array.from(ids).map(id => this.idMap.get(id)!).filter(Boolean);
  }

  public getByTag(tag: string): HandbookDocument[] {
    const ids = this.tagMap.get(tag.toLowerCase());
    if (!ids) return [];
    return Array.from(ids).map(id => this.idMap.get(id)!).filter(Boolean);
  }

  public getByTaxonomyId(taxonomyId: string): HandbookDocument[] {
    const ids = this.taxonomyMap.get(taxonomyId.toLowerCase());
    if (!ids) return [];
    return Array.from(ids).map(id => this.idMap.get(id)!).filter(Boolean);
  }

  public getByToken(token: string): Set<string> {
    return this.tokenIndex.get(token.toLowerCase()) || new Set();
  }

  public getAll(): HandbookDocument[] {
    return Array.from(this.idMap.values());
  }

  public clear(): void {
    this.idMap.clear();
    this.titleMap.clear();
    this.categoryMap.clear();
    this.tagMap.clear();
    this.taxonomyMap.clear();
    this.tokenIndex.clear();
  }

  public size(): number {
    return this.idMap.size;
  }
}
