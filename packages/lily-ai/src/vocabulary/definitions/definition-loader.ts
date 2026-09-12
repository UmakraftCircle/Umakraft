import { Definition, DEFINITION_SOURCES } from './definition-source.js';
import { DefinitionValidator } from './definition-validator.js';
import { DefinitionRegistry } from './definition-registry.js';

export const CORE_OFFLINE_DEFINITIONS: Definition[] = [
  // 1. External & Deep Conceptual Vocabulary (Wiktionary / WordNet Scale)
  {
    word: 'serendipity',
    definition: 'The occurrence and development of events by chance in a happy or beneficial way; finding valuable things unexpectedly.',
    partOfSpeech: 'noun',
    context: 'philosophy',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['Finding the rare inheritance spark was pure serendipity.'],
    synonyms: ['chance', 'fortune', 'fluke'],
    tags: ['cognition', 'philosophy', 'luck']
  },
  {
    word: 'epistemology',
    definition: 'The branch of philosophy concerned with the theory of knowledge, its nature, justification, and scope.',
    partOfSpeech: 'noun',
    context: 'philosophy',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['Her epistemology centers around empirical data verification.'],
    synonyms: ['theory of knowledge', 'gnosiology'],
    tags: ['philosophy', 'logic', 'knowledge']
  },
  {
    word: 'heuristics',
    definition: 'Practical methods or rules of thumb that are not guaranteed to be optimal or perfect, but sufficient for immediate problem solving.',
    partOfSpeech: 'noun',
    context: 'computer_science',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['We apply race position heuristics when selecting early turn skills.'],
    synonyms: ['rule of thumb', 'algorithm', 'shortcut'],
    tags: ['computer_science', 'logic', 'strategy']
  },
  {
    word: 'paradigm',
    definition: 'A typical example, pattern, or distinct theoretical framework of concepts and standards in a discipline.',
    partOfSpeech: 'noun',
    context: 'general',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['The update introduced a new training paradigm focused on guts.'],
    synonyms: ['model', 'framework', 'archetype'],
    tags: ['framework', 'system']
  },
  {
    word: 'synergy',
    definition: 'The interaction or cooperation of two or more entities to produce a combined effect greater than the sum of their separate effects.',
    partOfSpeech: 'noun',
    context: 'strategy',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['The synergy between front runner skills and high speed stats produces unmatched late-race acceleration.'],
    synonyms: ['collaboration', 'cooperation', 'harmony'],
    tags: ['strategy', 'teamwork']
  },
  {
    word: 'homeostasis',
    definition: 'The tendency toward a relatively stable equilibrium between interdependent physiological elements.',
    partOfSpeech: 'noun',
    context: 'biology',
    source: 'wordnet',
    authority: 75,
    confidence: 0.90,
    examples: ['Stamina management ensures biological homeostasis throughout the distance.'],
    synonyms: ['equilibrium', 'balance'],
    tags: ['biology', 'science']
  },
  {
    word: 'ubiquitous',
    definition: 'Present, appearing, or found everywhere simultaneously; omnipresent.',
    partOfSpeech: 'adjective',
    context: 'general',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['Speed cards are ubiquitous in competitive deck compositions.'],
    synonyms: ['omnipresent', 'pervasive', 'universal'],
    tags: ['descriptor', 'general']
  },
  {
    word: 'pragmatic',
    definition: 'Dealing with things sensibly and realistically in a way that is based on practical rather than theoretical considerations.',
    partOfSpeech: 'adjective',
    context: 'general',
    source: 'wordnet',
    authority: 75,
    confidence: 0.90,
    examples: ['Taking a pragmatic approach to training priorities yielded consistent wins.'],
    synonyms: ['practical', 'realistic', 'sensible'],
    tags: ['behavior', 'philosophy']
  },
  {
    word: 'catalyst',
    definition: 'A substance, person, or event that causes or accelerates an important change or reaction.',
    partOfSpeech: 'noun',
    context: 'science',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['The milestone announcement acted as a catalyst for community activity.'],
    synonyms: ['spark', 'stimulus', 'trigger'],
    tags: ['science', 'change']
  },
  {
    word: 'fastidious',
    definition: 'Very attentive to and concerned about accuracy and detail; meticulous.',
    partOfSpeech: 'adjective',
    context: 'general',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['A fastidious trainer meticulously tracks fan margins every turn.'],
    synonyms: ['meticulous', 'scrupulous', 'exacting'],
    tags: ['character', 'trait']
  },
  {
    word: 'tenacious',
    definition: 'Tending to keep a firm hold of something; clinging or adhering closely; persistent and unyielding.',
    partOfSpeech: 'adjective',
    context: 'character',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['A tenacious chaser holds ground in the final stretch.'],
    synonyms: ['persistent', 'resolute', 'determined'],
    tags: ['trait', 'racing']
  },
  {
    word: 'juxtaposition',
    definition: 'The fact of two things being seen or placed close together with contrasting effect.',
    partOfSpeech: 'noun',
    context: 'general',
    source: 'wordnet',
    authority: 75,
    confidence: 0.90,
    examples: ['The juxtaposition of sprint power and long-distance endurance highlighted different build strategies.'],
    synonyms: ['contrast', 'comparison', 'proximity'],
    tags: ['analysis', 'literature']
  },

  // 2. Multi-Definition Entries for Polysemous Terms
  // Term: RACE
  {
    word: 'race',
    definition: 'A high-speed competition between runners, horses, or vehicles to determine the fastest finisher.',
    partOfSpeech: 'noun',
    context: 'racing',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['She entered the G1 Arima Kinen race with high expectations.'],
    synonyms: ['competition', 'contest', 'derby'],
    tags: ['racing', 'sports', 'speed', 'competition']
  },
  {
    word: 'race',
    definition: 'A categorization of humans or beings based on shared physical traits, ancestry, or cultural heritage.',
    partOfSpeech: 'noun',
    context: 'anthropology',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['Anthropological studies classify population groups across historical migrations.'],
    synonyms: ['ethnic group', 'lineage', 'peoples'],
    tags: ['anthropology', 'demographics', 'social']
  },
  {
    word: 'race',
    definition: 'A distinct subspecies, breed, or geographical population within a biological species.',
    partOfSpeech: 'noun',
    context: 'biology',
    source: 'wordnet',
    authority: 75,
    confidence: 0.90,
    examples: ['Botanists identified an indigenous geographical race of mountain flora.'],
    synonyms: ['subspecies', 'breed', 'strain'],
    tags: ['biology', 'botany', 'zoology']
  },

  // Term: PACE
  {
    word: 'pace',
    definition: 'The rate of speed or tempo maintained during a run, walk, or competitive race.',
    partOfSpeech: 'noun',
    context: 'racing',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['A steady early pace preserves vital stamina for the final straight.'],
    synonyms: ['tempo', 'cadence', 'speed'],
    tags: ['racing', 'sports', 'tempo']
  },
  {
    word: 'pace',
    definition: 'A single step taken in walking or running, or a linear unit of measure based on step length.',
    partOfSpeech: 'noun',
    context: 'measurement',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['He stepped back three paces from the gate.'],
    synonyms: ['step', 'stride', 'measure'],
    tags: ['measurement', 'distance']
  },

  // Term: SPARK
  {
    word: 'spark',
    definition: 'An inheritance trigger or inspiration factor in training that awards stat bonuses and skill hints.',
    partOfSpeech: 'noun',
    context: 'uma_musume',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['A 3-star stamina spark activated during the second summer training.'],
    synonyms: ['inheritance factor', 'inspiration', 'gene trigger'],
    tags: ['uma_musume', 'breeding', 'inheritance']
  },
  {
    word: 'spark',
    definition: 'A tiny glowing particle thrown off from a fire, or a luminous electrical discharge between electrodes.',
    partOfSpeech: 'noun',
    context: 'physics',
    source: 'wordnet',
    authority: 75,
    confidence: 0.90,
    examples: ['An electrical spark jumped between the two metal contact points.'],
    synonyms: ['flash', 'glimmer', 'arc'],
    tags: ['physics', 'electricity', 'fire']
  },

  // Term: BUILD
  {
    word: 'build',
    definition: 'A tailored configuration of stats, skills, support card deck, and inheritance factors for a character.',
    partOfSpeech: 'noun',
    context: 'strategy',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['This sprint build prioritizes 1200 speed and 5 acceleration skills.'],
    synonyms: ['configuration', 'setup', 'loadout'],
    tags: ['strategy', 'gaming', 'deck', 'stats']
  },
  {
    word: 'build',
    definition: 'The physical proportions, size, or structural frame of a person or object.',
    partOfSpeech: 'noun',
    context: 'physical',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['The athlete had a tall, muscular build well suited for stamina events.'],
    synonyms: ['physique', 'frame', 'figure'],
    tags: ['anatomy', 'physical']
  },

  // Term: FAN
  {
    word: 'fan',
    definition: 'A registered follower and supporter whose count reflects trainer progress, club standings, and event unlocks.',
    partOfSpeech: 'noun',
    context: 'uma_musume',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['Reaching 100 million fans unlocks the elite club tier.'],
    synonyms: ['supporter', 'admirer', 'patron'],
    tags: ['uma_musume', 'fans', 'milestone']
  },
  {
    word: 'fan',
    definition: 'A mechanical apparatus with revolving blades used to circulate air for cooling or ventilation.',
    partOfSpeech: 'noun',
    context: 'appliance',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['Turn on the ceiling fan to cool down the clubhouse.'],
    synonyms: ['ventilator', 'blower', 'cooler'],
    tags: ['appliance', 'hardware']
  },

  // Term: LINK
  {
    word: 'link',
    definition: 'A verified connection between a Discord user account and a game trainer profile.',
    partOfSpeech: 'noun',
    context: 'system',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['Use /link with your 9-digit trainer ID to establish the account link.'],
    synonyms: ['association', 'binding', 'connection'],
    tags: ['system', 'account', 'discord']
  },
  {
    word: 'link',
    definition: 'A clickable reference or URL in an electronic document leading to another destination.',
    partOfSpeech: 'noun',
    context: 'computing',
    source: 'wiktionary',
    authority: 85,
    confidence: 0.95,
    examples: ['Follow the hyperlink in the documentation for further reading.'],
    synonyms: ['hyperlink', 'url', 'web address'],
    tags: ['computing', 'internet']
  },

  // 3. Domain & Competitive Racing Definitions
  {
    word: 'stamina',
    definition: 'The endurance capacity of a runner allowing sustained energy output across long race distances without exhaustion.',
    partOfSpeech: 'noun',
    context: 'racing',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['Long distance courses require at least 900 stamina plus recovery skills.'],
    synonyms: ['endurance', 'staying power', 'resilience'],
    tags: ['racing', 'stats', 'stamina']
  },
  {
    word: 'guts',
    definition: 'The willpower and late-race grit that reduces stamina depletion rate when fighting for position in the final straight.',
    partOfSpeech: 'noun',
    context: 'racing',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['High guts gives competitive advantage in fierce side-by-side stretch duels.'],
    synonyms: ['grit', 'willpower', 'tenacity', 'determination'],
    tags: ['racing', 'stats', 'guts']
  },
  {
    word: 'wisdom',
    definition: 'The intelligence stat determining skill activation consistency, race positioning choices, and stamina pacing efficiency.',
    partOfSpeech: 'noun',
    context: 'racing',
    source: 'curated_dictionary',
    authority: 100,
    confidence: 1.0,
    examples: ['A wisdom score above 600 ensures a 90%+ skill triggering probability.'],
    synonyms: ['intelligence', 'knowledge', 'racing iq'],
    tags: ['racing', 'stats', 'wisdom']
  }
];

export class DefinitionLoader {
  /**
   * Loads the default offline definition dataset into a newly instantiated registry.
   */
  public static load(entries: Definition[] = CORE_OFFLINE_DEFINITIONS): DefinitionRegistry {
    const registry = new DefinitionRegistry();
    this.populateRegistry(registry, entries);
    return registry;
  }

  /**
   * Populates an existing registry with definition entries after validation.
   */
  public static populateRegistry(registry: DefinitionRegistry, entries: Definition[]): number {
    let addedCount = 0;
    for (const entry of entries) {
      const validation = DefinitionValidator.validate(entry);
      if (validation.valid) {
        registry.register(entry);
        addedCount++;
      }
    }
    return addedCount;
  }

  /**
   * Loads definitions from an offline JSONL string (such as an extracted Wiktionary or WordNet dump).
   */
  public static loadFromJSONL(jsonlContent: string, defaultSource = 'wiktionary'): Definition[] {
    const lines = jsonlContent.split(/\r?\n/);
    const results: Definition[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      try {
        const parsed = JSON.parse(trimmed);
        const item: Definition = {
          word: parsed.word || parsed.term || '',
          definition: parsed.definition || parsed.meaning || parsed.gloss || '',
          partOfSpeech: parsed.partOfSpeech || parsed.pos || 'noun',
          context: parsed.context || 'general',
          examples: Array.isArray(parsed.examples) ? parsed.examples : parsed.example ? [parsed.example] : undefined,
          synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : undefined,
          antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms : undefined,
          source: parsed.source || defaultSource,
          authority: parsed.authority || DEFINITION_SOURCES.WIKTIONARY.authority,
          confidence: parsed.confidence || DEFINITION_SOURCES.WIKTIONARY.confidence,
          tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
          timestamp: parsed.timestamp || Date.now()
        };

        const validation = DefinitionValidator.validate(item);
        if (validation.valid) {
          results.push(item);
        }
      } catch {
        // Skip malformed lines safely in offline stream
      }
    }

    return results;
  }

  /**
   * Converts definitions into an offline JSONL string for local caching or storage.
   */
  public static exportToJSONL(definitions: Definition[]): string {
    return definitions.map(def => JSON.stringify(def)).join('\n');
  }

  /**
   * Converts an array of loosely shaped definition records into normalized Definition objects.
   */
  public static loadFromRecords(records: Partial<Definition>[], defaultSource = 'wiktionary'): Definition[] {
    const results: Definition[] = [];
    for (const rec of records) {
      if (!rec.word || !rec.definition) continue;
      const def: Definition = {
        word: rec.word.trim(),
        definition: rec.definition.trim(),
        partOfSpeech: rec.partOfSpeech || 'noun',
        context: rec.context || 'general',
        examples: rec.examples,
        synonyms: rec.synonyms,
        antonyms: rec.antonyms,
        source: rec.source || defaultSource,
        authority: rec.authority || (rec.source ? DEFINITION_SOURCES[rec.source.toUpperCase()]?.authority || 85 : 85),
        confidence: rec.confidence || (rec.source ? DEFINITION_SOURCES[rec.source.toUpperCase()]?.confidence || 0.95 : 0.95),
        tags: rec.tags,
        timestamp: rec.timestamp || Date.now()
      };
      if (DefinitionValidator.validate(def).valid) {
        results.push(def);
      }
    }
    return results;
  }
}
