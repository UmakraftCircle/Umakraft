export interface NormalizedDictionaryResult {
  original: string;
  normalized: string;
  lemma: string;
  wasStemmed: boolean;
}

export class DictionaryNormalizer {
  // Irregular words mapping (inflected -> lemma)
  private static readonly IRREGULARS: Record<string, string> = {
    // Adjective comparatives & superlatives
    'better': 'good',
    'best': 'good',
    'worse': 'bad',
    'worst': 'bad',
    'farther': 'far',
    'farthest': 'far',
    'further': 'far',
    'furthest': 'far',
    'more': 'many',
    'most': 'many',
    'less': 'little',
    'least': 'little',

    // Verb irregulars
    'ran': 'run',
    'running': 'run',
    'runs': 'run',
    'won': 'win',
    'winning': 'win',
    'wins': 'win',
    'went': 'go',
    'gone': 'go',
    'going': 'go',
    'goes': 'go',
    'came': 'come',
    'coming': 'come',
    'comes': 'come',
    'did': 'do',
    'done': 'do',
    'doing': 'do',
    'does': 'do',
    'had': 'have',
    'having': 'have',
    'has': 'have',
    'said': 'say',
    'saying': 'say',
    'says': 'say',
    'made': 'make',
    'making': 'make',
    'makes': 'make',
    'took': 'take',
    'taken': 'take',
    'taking': 'take',
    'takes': 'take',
    'saw': 'see',
    'seen': 'see',
    'seeing': 'see',
    'sees': 'see',
    'gave': 'give',
    'given': 'give',
    'giving': 'give',
    'gives': 'give',
    'thought': 'think',
    'thinking': 'think',
    'thinks': 'think',
    'spoke': 'speak',
    'spoken': 'speak',
    'speaking': 'speak',
    'speaks': 'speak',
    'wrote': 'write',
    'written': 'write',
    'writing': 'write',
    'writes': 'write',
    'read': 'read',
    'reading': 'read',
    'reads': 'read',
    'heard': 'hear',
    'hearing': 'hear',
    'hears': 'hear',
    'understood': 'understand',
    'understanding': 'understand',
    'understands': 'understand',
    'learnt': 'learn',
    'learned': 'learn',
    'learning': 'learn',
    'learns': 'learn',
    'taught': 'teach',
    'teaching': 'teach',
    'teaches': 'teach',
    'bought': 'buy',
    'buying': 'buy',
    'buys': 'buy',
    'fell': 'fall',
    'fallen': 'fall',
    'falling': 'fall',
    'falls': 'fall',
    'drove': 'drive',
    'driven': 'drive',
    'driving': 'drive',
    'drives': 'drive',

    // Studies / Studying / Studied
    'studies': 'study',
    'studying': 'study',
    'studied': 'study',

    // Irregular Plurals
    'children': 'child',
    'men': 'man',
    'women': 'woman',
    'people': 'person',
    'mice': 'mouse',
    'feet': 'foot',
    'teeth': 'tooth',
    'geese': 'goose'
  };

  /**
   * Normalizes word string and performs morphological resolution to lemma.
   */
  public static normalize(rawWord: string): NormalizedDictionaryResult {
    if (!rawWord) {
      return { original: '', normalized: '', lemma: '', wasStemmed: false };
    }

    const trimmed = rawWord.trim().toLowerCase();
    const cleaned = trimmed.replace(/^[^a-z0-9_]+|[^a-z0-9_]+$/gi, '');

    if (!cleaned) {
      return { original: rawWord, normalized: '', lemma: '', wasStemmed: false };
    }

    // 1. Check irregular lookup table
    if (this.IRREGULARS[cleaned]) {
      const lemma = this.IRREGULARS[cleaned];
      return {
        original: rawWord,
        normalized: lemma,
        lemma,
        wasStemmed: lemma !== cleaned
      };
    }

    // 2. Morphological rule-based stemmer
    const stemmed = this.morphologicalStem(cleaned);
    return {
      original: rawWord,
      normalized: stemmed,
      lemma: stemmed,
      wasStemmed: stemmed !== cleaned
    };
  }

  /**
   * Rule-based morphological reducer for English words.
   */
  public static morphologicalStem(word: string): string {
    if (word.length <= 3) return word;

    // Direct adverbs: diligently -> diligent, quickly -> quick, slowly -> slow
    if (word.endsWith('ly') && word.length > 4) {
      if (word.endsWith('ily') && word.length > 5) {
        return word.slice(0, -3) + 'y'; // happily -> happy
      }
      return word.slice(0, -2); // diligently -> diligent, quickly -> quick
    }

    // Comparatives / Superlatives
    if (word.endsWith('est') && word.length > 5) {
      // fastest -> fast, slowest -> slow, strongest -> strong, weakest -> weak
      const base = word.slice(0, -3);
      if (base.endsWith('i')) return base.slice(0, -1) + 'y'; // easiest -> easy
      if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
        return base.slice(0, -1); // biggest -> big
      }
      return base;
    }
    if (word.endsWith('er') && word.length > 4) {
      // faster -> fast, slower -> slow, stronger -> strong, weaker -> weak
      // Note: we avoid converting noun agent suffixes if handled or short
      if (word === 'runner' || word === 'trainer' || word === 'winner' || word === 'player') {
        return word; // preserve core nouns
      }
      const base = word.slice(0, -2);
      if (base.endsWith('i')) return base.slice(0, -1) + 'y'; // easier -> easy
      if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
        return base.slice(0, -1); // bigger -> big
      }
      return base;
    }

    // -ies / -ied: studies -> study, studied -> study, categories -> category
    if ((word.endsWith('ies') || word.endsWith('ied')) && word.length > 4) {
      return word.slice(0, -3) + 'y';
    }

    // -ing: running, racing, training, walking, playing
    if (word.endsWith('ing') && word.length > 4) {
      const base = word.slice(0, -3);
      // Doubled consonant: running -> run, winning -> win, swimming -> swim
      if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
        return base.slice(0, -1);
      }
      // Silent e: racing -> race, pacing -> pace, taking -> take, making -> make
      if (/^[a-z]+[bcdfghjklmnpqrstvwxyz]$/.test(base) && !/^[a-z]+(ck|sh|ch|th|ng|ll|ss|ff|zz)$/.test(base)) {
        // e.g. rac -> race, pac -> pace
        if (['rac', 'pac', 'tak', 'mak', 'com', 'giv', 'rid', 'writ', 'driv', 'hik'].includes(base)) {
          return base + 'e';
        }
      }
      return base;
    }

    // -ed: trained, walked, played, raced
    if (word.endsWith('ed') && word.length > 4) {
      if (word.endsWith('eed')) return word; // proceed, exceed
      const base = word.slice(0, -2);
      if (base.endsWith('e')) return word.slice(0, -1); // raced -> race
      if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
        return base.slice(0, -1); // dropped -> drop
      }
      // Silent e cases
      if (['rac', 'pac', 'lik', 'lov', 'hik', 'mov', 'us'].includes(base)) {
        return base + 'e';
      }
      return base;
    }

    // Plurals: -ses, -xes, -ches, -shes
    if (word.endsWith('es') && word.length > 4) {
      if (word.endsWith('sses') || word.endsWith('shes') || word.endsWith('ches') || word.endsWith('xes') || word.endsWith('zes')) {
        return word.slice(0, -2);
      }
      // races -> race
      if (word.endsWith('ces') || word.endsWith('ges') || word.endsWith('ves')) {
        return word.slice(0, -1);
      }
      return word.slice(0, -1); // e.g. games -> game
    }

    // Plurals: -s: runners -> runner, trainers -> trainer, players -> player, games -> game
    if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is') && word.length > 3) {
      return word.slice(0, -1);
    }

    return word;
  }
}
