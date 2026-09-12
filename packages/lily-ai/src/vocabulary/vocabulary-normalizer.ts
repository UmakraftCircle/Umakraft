export interface NormalizedWordResult {
  normalized: string;
  original: string;
}

export class VocabularyNormalizer {
  private static readonly IRREGULAR_LEMMAS: Record<string, string> = {
    // Verbs: run
    'running': 'run',
    'runs': 'run',
    'ran': 'run',

    // Verbs: go
    'goes': 'go',
    'going': 'go',
    'went': 'go',
    'gone': 'go',

    // Verbs: come
    'comes': 'come',
    'coming': 'come',
    'came': 'come',

    // Verbs: win
    'winning': 'win',
    'wins': 'win',
    'won': 'win',

    // Verbs: lose
    'losing': 'lose',
    'loses': 'lose',
    'lost': 'lose',

    // Verbs: see / know / think / take / give
    'sees': 'see',
    'seeing': 'see',
    'saw': 'see',
    'seen': 'see',
    'knows': 'know',
    'knowing': 'know',
    'knew': 'know',
    'known': 'know',
    'thinks': 'think',
    'thinking': 'think',
    'thought': 'think',
    'takes': 'take',
    'taking': 'take',
    'took': 'take',
    'taken': 'take',
    'gives': 'give',
    'giving': 'give',
    'gave': 'give',
    'given': 'give',
    'feels': 'feel',
    'feeling': 'feel',
    'felt': 'feel',
    'speaks': 'speak',
    'speaking': 'speak',
    'spoke': 'speak',
    'spoken': 'speak',

    // Adjectives: fast, slow, good, bad
    'faster': 'fast',
    'fastest': 'fast',
    'slower': 'slow',
    'slowest': 'slow',
    'better': 'good',
    'best': 'good',
    'worse': 'bad',
    'worst': 'bad',

    // Regular gaming / discord verb inflections
    'banned': 'ban',
    'banning': 'ban',
    'bans': 'ban',
    'kicked': 'kick',
    'kicking': 'kick',
    'kicks': 'kick',
    'muted': 'mute',
    'muting': 'mute',
    'mutes': 'mute',
    'pinged': 'ping',
    'pinging': 'ping',
    'pings': 'ping',
    'buffed': 'buff',
    'buffing': 'buff',
    'buffs': 'buff',
    'nerfed': 'nerf',
    'nerfing': 'nerf',
    'nerfs': 'nerf',

    // Common plurals
    'runners': 'runner',
    'players': 'player',
    'games': 'game',
    'skills': 'skill',
    'horses': 'horse',
    'tracks': 'track',
    'servers': 'server',
    'bots': 'bot',
    'mods': 'mod',
    'channels': 'channel',
    'messages': 'message',
    'roles': 'role',
    'guilds': 'guild'
  };

  /**
   * Normalizes word casing, trims whitespace and punctuation,
   * and reduces inflections (verbs/plurals/comparatives) to root lemma.
   */
  public static normalize(raw: string): NormalizedWordResult {
    const original = raw;
    const normalized = this.lemmatize(raw);
    return {
      normalized,
      original
    };
  }

  /**
   * Simple string-to-string normalization helper.
   */
  public static normalizeWord(raw: string): string {
    return this.lemmatize(raw);
  }

  /**
   * Lemmatizes a token to its root word base form.
   */
  public static lemmatize(raw: string): string {
    if (!raw) return '';

    // Clean whitespace and boundary punctuation
    let cleaned = raw
      .trim()
      .toLowerCase()
      .replace(/^[^a-z0-9_]+|[^a-z0-9_]+$/g, '');

    if (!cleaned) return '';

    // Check direct irregular dictionary
    if (this.IRREGULAR_LEMMAS[cleaned]) {
      return this.IRREGULAR_LEMMAS[cleaned];
    }

    // Preserve special compounds and short tokens
    if (cleaned.length <= 3) {
      return cleaned;
    }

    // Rule 1: -ing endings
    if (cleaned.endsWith('ing') && cleaned.length > 5) {
      const stem = cleaned.slice(0, -3);

      // Double consonant (running -> run, winning -> win, stepping -> step)
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
        return stem.slice(0, -1);
      }

      // Silent e (racing -> race, closing -> close, liking -> like)
      const silentECandidates = ['rac', 'lik', 'rid', 'mak', 'tak', 'giv', 'hop', 'clos', 'mov', 'writ'];
      if (silentECandidates.includes(stem)) {
        return stem + 'e';
      }

      return stem;
    }

    // Rule 2: -ed endings
    if (cleaned.endsWith('ed') && cleaned.length > 4) {
      const stem = cleaned.slice(0, -2);

      // Double consonant (stopped -> stop, dropped -> drop)
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
        return stem.slice(0, -1);
      }

      // -ied -> -y (tried -> try, carried -> carry)
      if (cleaned.endsWith('ied') && cleaned.length > 4) {
        return cleaned.slice(0, -3) + 'y';
      }

      // Silent e (trained -> train, liked -> like, closed -> close)
      if (stem.endsWith('c') || stem.endsWith('k') || stem.endsWith('s') || stem.endsWith('v')) {
        return stem + 'e';
      }

      return stem;
    }

    // Rule 3: -ies endings (cities -> city, strategies -> strategy)
    if (cleaned.endsWith('ies') && cleaned.length > 4) {
      return cleaned.slice(0, -3) + 'y';
    }

    // Rule 4: -es endings (watches -> watch, matches -> match, boxes -> box)
    if (cleaned.endsWith('es') && cleaned.length > 4) {
      if (
        cleaned.endsWith('ches') ||
        cleaned.endsWith('shes') ||
        cleaned.endsWith('sses') ||
        cleaned.endsWith('xes') ||
        cleaned.endsWith('zes')
      ) {
        return cleaned.slice(0, -2);
      }
    }

    // Rule 5: -s endings for standard plurals / 3rd person singular
    if (cleaned.endsWith('s') && !cleaned.endsWith('ss') && cleaned.length > 3) {
      return cleaned.slice(0, -1);
    }

    // Rule 6: -est endings (fastest -> fast, slowest -> slow)
    if (cleaned.endsWith('est') && cleaned.length > 5) {
      return cleaned.slice(0, -3);
    }

    // Rule 7: -er comparative endings (faster -> fast, slower -> slow)
    // Note: Do NOT strip -er from agent nouns like "runner" which has its own entry
    if (cleaned.endsWith('er') && cleaned.length > 4) {
      const comparatives = ['faster', 'slower', 'quicker', 'harder', 'longer', 'shorter'];
      if (comparatives.includes(cleaned)) {
        return cleaned.slice(0, -2);
      }
    }

    // Rule 8: -ly adverb endings (quickly -> quick)
    if (cleaned.endsWith('ly') && cleaned.length > 4) {
      return cleaned.slice(0, -2);
    }

    return cleaned;
  }
}
