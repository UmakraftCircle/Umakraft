export interface GlossaryEntry {
  term: string;
  domain: string;
  description: string;
  aliases: string[];
  source: string;
  type?: string;
}

export class GlossaryRegistry {
  private entries = new Map<string, GlossaryEntry>();

  constructor() {
    // Seed initial Umakraft and Discord Terms
    this.register({
      term: 'link',
      domain: 'Umakraft',
      description: 'The process of linking a trainer account to a Discord ID.',
      aliases: ['link account', 'account linking'],
      source: 'manual'
    });

    this.register({
      term: 'unlink',
      domain: 'Umakraft',
      description: 'The process of removing a linked trainer account from a Discord ID.',
      aliases: ['unlink account'],
      source: 'manual'
    });

    this.register({
      term: 'approval',
      domain: 'Umakraft',
      description: 'Operational workflow for approving pending club member requests.',
      aliases: ['approve request'],
      source: 'manual'
    });

    this.register({
      term: 'Champions Meeting',
      domain: 'Umamusume',
      description: 'A highly competitive monthly PvP event featuring a preset race condition.',
      aliases: ['cm', 'champions meeting'],
      source: 'manual',
      type: 'event'
    });

    this.register({
      term: 'League of Heroes',
      domain: 'Umamusume',
      description: 'A competitive event focusing on team accumulation of performance points.',
      aliases: ['loh', 'league of heroes'],
      source: 'manual',
      type: 'event'
    });
  }

  public register(entry: GlossaryEntry): void {
    this.entries.set(entry.term.toLowerCase().trim(), entry);
  }

  public lookup(term: string): GlossaryEntry | undefined {
    return this.entries.get(term.toLowerCase().trim());
  }

  public getEntries(): GlossaryEntry[] {
    return Array.from(this.entries.values());
  }
}
