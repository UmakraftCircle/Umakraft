import { GlossaryRegistry, GlossaryEntry } from './glossary-registry.js';
import { GlossaryResolver } from './glossary-resolver.js';
import { GlossarySearch } from './glossary-search.js';
import { GlossaryMemory } from './glossary-memory.js';
import { DomainDetector } from './domain-detector.js';
import { TerminologyEngine } from './terminology-engine.js';
import { TAXONOMY_DATA } from '../../knowledge/taxonomy/data.js';

export class GlossaryService {
  private registry = new GlossaryRegistry();
  private resolver = new GlossaryResolver(this.registry);
  private searchEngine = new GlossarySearch(this.registry);
  private memory = new GlossaryMemory();
  private detector = new DomainDetector();
  private terminologyEngine = new TerminologyEngine(this.registry);

  constructor() {
    this.importTaxonomy();
  }

  /**
   * Imports taxonomy terms dynamically from TAXONOMY_DATA into the glossary (Umamusume domain)
   */
  private importTaxonomy(): void {
    for (const entity of TAXONOMY_DATA) {
      // Map entity type to a clean description category
      let categoryDesc = entity.type.replace('_', ' ');
      categoryDesc = categoryDesc.charAt(0).toUpperCase() + categoryDesc.slice(1);

      this.registry.register({
        term: entity.canonical,
        domain: 'Umamusume',
        description: `Official Umamusume Taxonomy term representing a ${categoryDesc}.`,
        aliases: entity.aliases,
        source: 'taxonomy',
        type: entity.type
      });
    }
  }

  public register(entry: GlossaryEntry): void {
    this.registry.register(entry);
  }

  public lookup(term: string): GlossaryEntry | undefined {
    const entry = this.resolver.resolve(term);
    if (entry) {
      this.memory.record(entry.term);
    }
    return entry;
  }

  public matchTerms(text: string): GlossaryEntry[] {
    const matched: GlossaryEntry[] = [];
    const normalizedText = text.toLowerCase();
    
    for (const entry of this.registry.getEntries()) {
      let isMatched = false;
      
      // Match canonical term
      const termRegex = new RegExp(`\\b${entry.term.toLowerCase()}\\b`, 'i');
      if (termRegex.test(normalizedText)) {
        isMatched = true;
      } else {
        // Match aliases
        for (const alias of entry.aliases) {
          const aliasRegex = new RegExp(`\\b${alias.toLowerCase()}\\b`, 'i');
          if (aliasRegex.test(normalizedText)) {
            isMatched = true;
            break;
          }
        }
      }

      if (isMatched) {
        matched.push(entry);
        this.memory.record(entry.term);
      }
    }

    return matched;
  }

  public search(): GlossarySearch {
    return this.searchEngine;
  }

  public getMemory(): GlossaryMemory {
    return this.memory;
  }

  public detectDomains(text: string): string[] {
    return this.detector.detect(text);
  }

  public getTerminologyEngine(): TerminologyEngine {
    return this.terminologyEngine;
  }
}
