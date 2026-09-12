import { GlossaryRegistry, GlossaryEntry } from './glossary-registry.js';

export class GlossarySearch {
  private registry: GlossaryRegistry;

  constructor(registry: GlossaryRegistry) {
    this.registry = registry;
  }

  /**
   * Search glossary entries matching term name exactly or fuzzy (using partial matches)
   */
  public searchTerm(term: string): GlossaryEntry[] {
    const clean = term.toLowerCase().trim();
    return this.registry.getEntries().filter(e => e.term.toLowerCase().includes(clean));
  }

  /**
   * Search entries by alias list
   */
  public searchAlias(alias: string): GlossaryEntry[] {
    const clean = alias.toLowerCase().trim();
    return this.registry.getEntries().filter(e =>
      e.aliases.some(a => a.toLowerCase() === clean || a.toLowerCase().includes(clean))
    );
  }

  /**
   * Search entries by domain name
   */
  public searchDomain(domain: string): GlossaryEntry[] {
    const clean = domain.toLowerCase().trim();
    return this.registry.getEntries().filter(e => e.domain.toLowerCase() === clean);
  }

  /**
   * Search entries by descriptions containing keywords
   */
  public searchDescription(query: string): GlossaryEntry[] {
    const clean = query.toLowerCase().trim();
    return this.registry.getEntries().filter(e => e.description.toLowerCase().includes(clean));
  }
}
