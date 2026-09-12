export class AliasService {
  private aliases = new Map<string, string>();

  constructor() {
    this.register('nige', 'Front Runner');
    this.register('senkou', 'Pace Chaser');
    this.register('senko', 'Pace Chaser');
    this.register('sashi', 'Late Surger');
    this.register('oikomi', 'End Closer');
    this.register('oikome', 'End Closer');
    this.register('champions meeting', 'Champions Meeting');
    this.register('cm', 'Champions Meeting');
    this.register('league of heroes', 'League of Heroes');
    this.register('loh', 'League of Heroes');
  }

  public register(alias: string, canonical: string): void {
    this.aliases.set(alias.toLowerCase().trim(), canonical);
  }

  public resolve(term: string): string | undefined {
    return this.aliases.get(term.toLowerCase().trim());
  }

  public getAllAliases(): string[] {
    return Array.from(this.aliases.keys());
  }
}
