import { TaxonomyNode, TaxonomyRegistry } from './taxonomy-loader.js';

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
}

export class TaxonomyValidator {
  /**
   * Validates a TaxonomyRegistry for structural integrity and standard compliance:
   * 1. Duplicate IDs
   * 2. Duplicate Names (within the same category)
   * 3. Missing Categories
   * 4. Invalid Aliases (empty strings, whitespace-only, redundant aliases)
   * 5. Broken References (references in metadata pointing to non-existent node IDs)
   */
  public static validate(registry: TaxonomyRegistry): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    const nodes = registry.getAll();
    const seenIds = new Set<string>();
    const seenCategoryNames = new Map<string, string>(); // "category:name" -> nodeId

    for (const node of nodes) {
      // 1. Duplicate or missing IDs
      if (!node.id || !node.id.trim()) {
        errors.push(`Node is missing a required id: "${JSON.stringify(node)}"`);
      } else if (seenIds.has(node.id)) {
        errors.push(`Duplicate node id detected: "${node.id}"`);
      } else {
        seenIds.add(node.id);
      }

      // 2. Missing Category
      if (!node.category || !node.category.trim()) {
        errors.push(`Node "${node.id}" is missing a valid category`);
      }

      // 3. Missing or Duplicate Names within Category
      if (!node.name || !node.name.trim()) {
        errors.push(`Node "${node.id}" is missing an official name`);
      } else if (node.category) {
        const catNameKey = `${node.category.toLowerCase().trim()}:${node.name.toLowerCase().trim()}`;
        if (seenCategoryNames.has(catNameKey)) {
          const prevId = seenCategoryNames.get(catNameKey);
          errors.push(`Duplicate official name "${node.name}" in category "${node.category}" between "${prevId}" and "${node.id}"`);
        } else {
          seenCategoryNames.set(catNameKey, node.id);
        }
      }

      // 4. Invalid Aliases
      if (!Array.isArray(node.aliases)) {
        errors.push(`Node "${node.id}" aliases must be an array`);
      } else {
        const seenAliasesInNode = new Set<string>();
        for (const alias of node.aliases) {
          if (typeof alias !== 'string' || !alias.trim()) {
            errors.push(`Node "${node.id}" has invalid or empty alias`);
          } else {
            const normAlias = alias.toLowerCase().trim();
            if (normAlias === node.name.toLowerCase().trim()) {
              warnings.push(`Node "${node.id}" has redundant alias matching its official name: "${alias}"`);
            }
            if (seenAliasesInNode.has(normAlias)) {
              warnings.push(`Node "${node.id}" has duplicate alias within itself: "${alias}"`);
            } else {
              seenAliasesInNode.add(normAlias);
            }
          }
        }
      }

      // 5. Broken References in metadata
      if (node.metadata) {
        const refKeys = ['parentId', 'referenceId', 'characterId', 'trackId', 'skillId'];
        for (const key of refKeys) {
          const ref = node.metadata[key];
          if (typeof ref === 'string' && ref.trim()) {
            if (!registry.get(ref.trim())) {
              warnings.push(`Node "${node.id}" references unknown ${key} "${ref}"`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      nodeCount: nodes.length
    };
  }
}
