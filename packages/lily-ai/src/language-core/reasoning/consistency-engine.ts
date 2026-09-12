import { LilyAntonymEngine } from '../../vocabulary/antonyms/antonym-engine.js';

export interface ConsistencyIssue {
  type: 'contradiction' | 'conflict' | 'mismatch';
  field: string;
  values: any[];
  description: string;
}

export interface ConsistencyResult {
  consistent: boolean;
  inconsistent: boolean;
  contradiction?: boolean;
  conflict?: boolean;
  issues: ConsistencyIssue[];
}

export class ConsistencyEngine {
  private antonymEngine = new LilyAntonymEngine();

  public getAntonymEngine(): LilyAntonymEngine {
    return this.antonymEngine;
  }

  /**
   * Checks for contradictions or conflicts in text, statements, facts, or context
   */
  public check(
    input: string | any[] | { text?: string; statements?: string[]; facts?: any[]; context?: Record<string, any> }
  ): ConsistencyResult {
    const issues: ConsistencyIssue[] = [];

    let text = '';
    let statements: string[] = [];
    let facts: any[] = [];

    if (typeof input === 'string') {
      text = input;
    } else if (Array.isArray(input)) {
      if (input.length > 0 && typeof input[0] === 'string') {
        statements = input as string[];
      } else {
        facts = input;
      }
    } else if (input && typeof input === 'object') {
      text = input.text || '';
      statements = input.statements || [];
      facts = input.facts || [];
    }

    // 1. Semantic Antonym Contradiction Detection across statements / clauses
    const lines = statements.length > 0
      ? statements
      : text.split(/(?:\r?\n|vs\.?|versus|\.|\band\b)/i).map(s => s.trim()).filter(s => s.length > 0);

    if (lines.length >= 2) {
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const contra = this.antonymEngine.checkContradiction(lines[i], lines[j]);
          if (contra.contradiction) {
            issues.push({
              type: 'contradiction',
              field: 'statement',
              values: [lines[i], lines[j]],
              description: contra.explanation || `Contradiction detected between '${lines[i]}' and '${lines[j]}'`
            });
          }
        }
      }
    }

    // 2. Text-based detection of repeated contradictory keys (e.g. "Current Fans: 120M" and "Current Fans: 150M")
    if (text) {
      // Current fans multiple specifications
      const fanMatches = Array.from(text.matchAll(/current\s*(?:fans)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/gi));
      if (fanMatches.length >= 2) {
        const vals = fanMatches.map(m => parseFloat(m[1]));
        const uniqueVals = Array.from(new Set(vals));
        if (uniqueVals.length > 1) {
          issues.push({
            type: 'contradiction',
            field: 'currentFans',
            values: uniqueVals.map(v => `${v}M`),
            description: `Contradictory values for current fans: ${uniqueVals.map(v => `${v}M`).join(' vs ')}`
          });
        }
      }

      // Required fans multiple specifications
      const reqMatches = Array.from(text.matchAll(/require(?:d|ment)?\s*(?:fans)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/gi));
      if (reqMatches.length >= 2) {
        const vals = reqMatches.map(m => parseFloat(m[1]));
        const uniqueVals = Array.from(new Set(vals));
        if (uniqueVals.length > 1) {
          issues.push({
            type: 'contradiction',
            field: 'requiredFans',
            values: uniqueVals.map(v => `${v}M`),
            description: `Contradictory values for required fans: ${uniqueVals.map(v => `${v}M`).join(' vs ')}`
          });
        }
      }

      // Surface conflict: "Surface: Turf" vs "Surface: Dirt"
      const hasTurf = /surface\s*[:=]?\s*turf/i.test(text) || (text.toLowerCase().includes('turf') && text.toLowerCase().includes('surface:'));
      const hasDirt = /surface\s*[:=]?\s*dirt/i.test(text) || (text.toLowerCase().includes('dirt') && text.toLowerCase().includes('surface:'));
      if (hasTurf && hasDirt) {
        issues.push({
          type: 'conflict',
          field: 'surface',
          values: ['Turf', 'Dirt'],
          description: 'Conflicting surface specifications: Turf and Dirt cannot both apply simultaneously'
        });
      }

      // Distance conflict
      const distMatches: string[] = [];
      if (/distance\s*[:=]?\s*sprint/i.test(text)) distMatches.push('Sprint');
      if (/distance\s*[:=]?\s*mile/i.test(text)) distMatches.push('Mile');
      if (/distance\s*[:=]?\s*medium/i.test(text)) distMatches.push('Medium');
      if (/distance\s*[:=]?\s*long/i.test(text)) distMatches.push('Long');
      if (distMatches.length >= 2) {
        issues.push({
          type: 'conflict',
          field: 'distance',
          values: distMatches,
          description: `Conflicting race distances specified: ${distMatches.join(' vs ')}`
        });
      }
    }

    // 3. Facts-based detection
    if (facts.length > 0) {
      const fieldGroups = new Map<string, any[]>();
      for (const f of facts) {
        const key = (f.name || f.key || f.field || '').toLowerCase();
        if (!key) continue;
        if (!fieldGroups.has(key)) {
          fieldGroups.set(key, []);
        }
        fieldGroups.get(key)!.push(f.value !== undefined ? f.value : f);
      }

      for (const [key, values] of fieldGroups.entries()) {
        const uniqueValues = Array.from(new Set(values.map(v => typeof v === 'object' ? JSON.stringify(v) : v)));
        if (uniqueValues.length > 1) {
          const isSurface = key.includes('surface');
          // Check if values are antonyms
          const isOpposite = uniqueValues.length === 2 &&
            typeof uniqueValues[0] === 'string' &&
            typeof uniqueValues[1] === 'string' &&
            this.antonymEngine.areOpposites(uniqueValues[0], uniqueValues[1]);

          issues.push({
            type: isSurface ? 'conflict' : 'contradiction',
            field: key,
            values: uniqueValues,
            description: isOpposite
              ? `Direct antonym contradiction detected for field '${key}': '${uniqueValues[0]}' vs '${uniqueValues[1]}'`
              : `Contradiction detected for field '${key}' with differing values: ${uniqueValues.join(', ')}`
          });
        }
      }
    }

    const hasInconsistency = issues.length > 0;
    const hasContradiction = issues.some(i => i.type === 'contradiction');
    const hasConflict = issues.some(i => i.type === 'conflict');

    return {
      consistent: !hasInconsistency,
      inconsistent: hasInconsistency,
      contradiction: hasContradiction,
      conflict: hasConflict ? true : hasInconsistency ? false : undefined,
      issues
    };
  }
}

