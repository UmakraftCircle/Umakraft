import { HandbookDocument, HandbookCategory } from './handbook-types.js';
import { HandbookIndexer } from './handbook-indexer.js';
import { HandbookValidator, HandbookValidationReport } from './handbook-validator.js';

export class HandbookRegistry {
  private indexer = new HandbookIndexer();
  private validationReport: HandbookValidationReport = {
    valid: true,
    totalDocuments: 0,
    validDocuments: 0,
    invalidDocuments: 0,
    issues: []
  };

  constructor(documents?: HandbookDocument[]) {
    if (documents) {
      for (const doc of documents) {
        this.register(doc);
      }
      this.validate();
    }
  }

  public register(document: HandbookDocument): void {
    this.indexer.index(document);
  }

  public validate(): HandbookValidationReport {
    this.validationReport = HandbookValidator.validateAll(this.getAll());
    return this.validationReport;
  }

  public getValidationReport(): HandbookValidationReport {
    return this.validationReport;
  }

  public getIndexer(): HandbookIndexer {
    return this.indexer;
  }

  public getDocument(id: string): HandbookDocument | undefined {
    return this.indexer.getById(id);
  }

  public getByTitle(title: string): HandbookDocument | undefined {
    return this.indexer.getByTitle(title);
  }

  public getByCategory(category: HandbookCategory | string): HandbookDocument[] {
    return this.indexer.getByCategory(category);
  }

  public getByTag(tag: string): HandbookDocument[] {
    return this.indexer.getByTag(tag);
  }

  public getByTaxonomyId(taxId: string): HandbookDocument[] {
    return this.indexer.getByTaxonomyId(taxId);
  }

  public getAll(): HandbookDocument[] {
    return this.indexer.getAll();
  }

  public getRelatedDocuments(documentId: string): HandbookDocument[] {
    const doc = this.getDocument(documentId);
    if (!doc) return [];

    const related: HandbookDocument[] = [];
    if (doc.relatedDocumentIds) {
      for (const relId of doc.relatedDocumentIds) {
        const relDoc = this.getDocument(relId);
        if (relDoc) related.push(relDoc);
      }
    }

    // If fewer than 2 related docs found, find same-category or shared-tag documents
    if (related.length < 3) {
      const sameCategory = this.getByCategory(doc.category).filter(d => d.id !== doc.id && !related.some(r => r.id === d.id));
      related.push(...sameCategory.slice(0, 3 - related.length));
    }

    return related;
  }

  public size(): number {
    return this.indexer.size();
  }
}
