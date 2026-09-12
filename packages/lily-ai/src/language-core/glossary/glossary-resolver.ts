import { GlossaryRegistry, GlossaryEntry } from './glossary-registry.js';

export class GlossaryResolver {
  private registry: GlossaryRegistry;

  constructor(registry: GlossaryRegistry) {
    this.registry = registry;
  }

  /**
   * Resolves a term or alias to the canonical glossary entry
   */
  public resolve(term: string): GlossaryEntry | undefined {
    const clean = term.toLowerCase().trim();
    
    // 1. Direct term lookup
    const direct = this.registry.lookup(clean);
    if (direct) return direct;

    // 2. Alias match
    return this.registry.getEntries().find(e =>
      e.aliases.some(alias => alias.toLowerCase() === clean)
    );
  }
}
