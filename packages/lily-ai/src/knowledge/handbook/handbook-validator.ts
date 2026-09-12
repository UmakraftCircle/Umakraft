import { HandbookDocument } from './handbook-types.js';

export interface HandbookValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface HandbookValidationReport {
  valid: boolean;
  totalDocuments: number;
  validDocuments: number;
  invalidDocuments: number;
  issues: {
    documentId: string;
    issues: HandbookValidationIssue[];
  }[];
}

export class HandbookValidator {
  public static validateDocument(doc: HandbookDocument): HandbookValidationIssue[] {
    const issues: HandbookValidationIssue[] = [];

    if (!doc.id || typeof doc.id !== 'string' || doc.id.trim().length === 0) {
      issues.push({ field: 'id', message: 'Document ID is required and must be non-empty', severity: 'error' });
    }

    if (!doc.title || typeof doc.title !== 'string' || doc.title.trim().length < 3) {
      issues.push({ field: 'title', message: 'Document title must be at least 3 characters', severity: 'error' });
    }

    if (!doc.category || typeof doc.category !== 'string') {
      issues.push({ field: 'category', message: 'Document category is required', severity: 'error' });
    }

    if (!Array.isArray(doc.tags)) {
      issues.push({ field: 'tags', message: 'Document tags must be an array', severity: 'error' });
    }

    if (!doc.content || typeof doc.content !== 'string' || doc.content.trim().length < 10) {
      issues.push({ field: 'content', message: 'Document content must be at least 10 characters', severity: 'error' });
    }

    if (!doc.version || typeof doc.version !== 'string') {
      issues.push({ field: 'version', message: 'Document version is required', severity: 'error' });
    }

    if (!doc.updatedAt || !(doc.updatedAt instanceof Date) || isNaN(doc.updatedAt.getTime())) {
      issues.push({ field: 'updatedAt', message: 'Document updatedAt must be a valid Date', severity: 'error' });
    }

    if (doc.deprecated) {
      issues.push({ field: 'deprecated', message: 'Document is marked as deprecated', severity: 'warning' });
    }

    return issues;
  }

  public static validateAll(documents: HandbookDocument[]): HandbookValidationReport {
    let validCount = 0;
    let invalidCount = 0;
    const documentIssues: { documentId: string; issues: HandbookValidationIssue[] }[] = [];

    for (const doc of documents) {
      const issues = this.validateDocument(doc);
      const errors = issues.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        invalidCount++;
        documentIssues.push({ documentId: doc.id || 'unknown', issues });
      } else {
        validCount++;
        if (issues.length > 0) {
          documentIssues.push({ documentId: doc.id, issues });
        }
      }
    }

    return {
      valid: invalidCount === 0,
      totalDocuments: documents.length,
      validDocuments: validCount,
      invalidDocuments: invalidCount,
      issues: documentIssues
    };
  }
}
