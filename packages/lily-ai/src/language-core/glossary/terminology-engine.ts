import { GlossaryResolver } from './glossary-resolver.js';
import { GlossaryRegistry, GlossaryEntry } from './glossary-registry.js';

export class TerminologyEngine {
  private resolver: GlossaryResolver;

  constructor(registry: GlossaryRegistry) {
    this.resolver = new GlossaryResolver(registry);
  }

  /**
   * Translates aliases or specialized terms to their canonical term representation
   */
  public resolveTerm(input: string): string {
    const entry = this.resolver.resolve(input);
    return entry ? entry.term : input;
  }

  /**
   * Returns the matching glossary entry if any
   */
  public getEntry(input: string): GlossaryEntry | undefined {
    return this.resolver.resolve(input);
  }
}
