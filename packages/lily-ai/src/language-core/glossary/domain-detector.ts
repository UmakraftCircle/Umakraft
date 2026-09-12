export class DomainDetector {
  private keywordDomains: { keywords: string[]; domain: string }[] = [
    {
      keywords: ['link', 'unlink', 'approval', 'approve', 'officer', 'leader', 'pending', 'contribution', 'milestone'],
      domain: 'Umakraft'
    },
    {
      keywords: ['runner', 'chaser', 'surger', 'closer', 'nige', 'senko', 'senkou', 'sashi', 'oikomi', 'parent', 'build', 'speed', 'stamina', 'power', 'guts', 'wit', 'wisdom', 'oguri', 'kitasan', 'champions meeting', 'league of heroes'],
      domain: 'Umamusume'
    },
    {
      keywords: ['guild', 'channel', 'server', 'role', 'dm', 'direct message', 'bot'],
      domain: 'Discord'
    },
    {
      keywords: ['agent', 'gemini', 'ai', 'intelligence', 'model', 'reasoning'],
      domain: 'AI'
    }
  ];

  /**
   * Detects domains referenced in the given message
   */
  public detect(text: string): string[] {
    const normalized = text.toLowerCase();
    const detected = new Set<string>();

    for (const item of this.keywordDomains) {
      for (const kw of item.keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(normalized)) {
          detected.add(item.domain);
        }
      }
    }

    if (detected.size === 0) {
      detected.add('General');
    }

    return Array.from(detected);
  }
}
