import { SynonymRegistry } from './synonym-registry.js';
import { SynonymEntry } from './synonym-entry.js';
import * as fs from 'fs';

export const DEFAULT_CORE_SYNONYMS: SynonymEntry[] = [
  {
    word: 'fast',
    synonyms: ['quick', 'rapid', 'swift', 'speedy', 'brisk', 'fleet', 'nimble'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'quick',
    synonyms: ['fast', 'rapid', 'swift', 'speedy', 'expeditious', 'prompt', 'brisk'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'rapid',
    synonyms: ['fast', 'quick', 'swift', 'speedy', 'accelerated', 'hasty'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'swift',
    synonyms: ['fast', 'quick', 'rapid', 'fleet', 'speedy', 'nimble'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'slow',
    synonyms: ['sluggish', 'unhurried', 'leisurely', 'gradual', 'late', 'slack'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'run',
    synonyms: ['sprint', 'dash', 'race', 'jog', 'gallop', 'hustle', 'bolt', 'rush'],
    confidence: 0.95,
    partOfSpeech: 'verb'
  },
  {
    word: 'sprint',
    synonyms: ['dash', 'run', 'burst', 'race', 'gallop', 'spurt'],
    confidence: 0.95,
    partOfSpeech: 'verb'
  },
  {
    word: 'runner',
    synonyms: ['racer', 'sprinter', 'contestant', 'competitor', 'athlete', 'steed', 'jockey'],
    confidence: 0.9,
    partOfSpeech: 'noun'
  },
  {
    word: 'trainer',
    synonyms: ['coach', 'instructor', 'mentor', 'tutor', 'handler', 'manager', 'teacher'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'coach',
    synonyms: ['trainer', 'instructor', 'mentor', 'guide', 'tutor'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'diligent',
    synonyms: ['hardworking', 'industrious', 'studious', 'assiduous', 'conscientious', 'meticulous', 'attentive'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'hardworking',
    synonyms: ['diligent', 'industrious', 'tireless', 'committed', 'dedicated'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'race',
    synonyms: ['competition', 'contest', 'derby', 'match', 'tournament', 'championship', 'event'],
    confidence: 1.0,
    context: 'competition',
    partOfSpeech: 'noun'
  },
  {
    word: 'race',
    synonyms: ['lineage', 'heritage', 'ancestry', 'ethnic group', 'origin', 'breed'],
    confidence: 0.9,
    context: 'population',
    partOfSpeech: 'noun'
  },
  {
    word: 'competition',
    synonyms: ['contest', 'match', 'tournament', 'championship', 'rivalry', 'challenge', 'race'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'train',
    synonyms: ['coach', 'practice', 'instruct', 'prepare', 'drill', 'exercise', 'develop'],
    confidence: 0.95,
    context: 'coaching',
    partOfSpeech: 'verb'
  },
  {
    word: 'train',
    synonyms: ['locomotive', 'railway cars', 'railroad car', 'transit'],
    confidence: 0.9,
    context: 'railway',
    partOfSpeech: 'noun'
  },
  {
    word: 'practice',
    synonyms: ['train', 'drill', 'rehearse', 'exercise', 'prepare', 'workout'],
    confidence: 0.9,
    partOfSpeech: 'verb'
  },
  {
    word: 'power',
    synonyms: ['strength', 'might', 'force', 'potency', 'energy', 'vigor', 'brawn'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'strength',
    synonyms: ['power', 'might', 'force', 'vigor', 'stamina', 'toughness'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'speed',
    synonyms: ['velocity', 'quickness', 'swiftness', 'pace', 'tempo', 'rapidity', 'rate'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'velocity',
    synonyms: ['speed', 'swiftness', 'rapidity', 'pace', 'momentum'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'stamina',
    synonyms: ['endurance', 'resilience', 'staying power', 'energy', 'vitality', 'durability'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'endurance',
    synonyms: ['stamina', 'resilience', 'persistence', 'staying power', 'durability'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'guts',
    synonyms: ['tenacity', 'courage', 'determination', 'willpower', 'grit', 'fortitude', 'pluck'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'tenacity',
    synonyms: ['grit', 'guts', 'persistence', 'stubbornness', 'determination', 'resilience'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'wisdom',
    synonyms: ['intelligence', 'knowledge', 'insight', 'prudence', 'sagacity', 'wit', 'acumen'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'intelligence',
    synonyms: ['wisdom', 'smartness', 'wit', 'intellect', 'cleverness', 'acumen'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'skill',
    synonyms: ['ability', 'technique', 'proficiency', 'talent', 'competence', 'expertise', 'knack'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'ability',
    synonyms: ['skill', 'capability', 'capacity', 'talent', 'aptitude', 'proficiency'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'win',
    synonyms: ['triumph', 'prevail', 'succeed', 'conquer', 'victor', 'beat'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'victory',
    synonyms: ['triumph', 'win', 'success', 'conquest', 'mastery'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'loss',
    synonyms: ['defeat', 'failure', 'setback', 'forfeiture'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'defeat',
    synonyms: ['loss', 'beating', 'overthrow', 'downfall', 'setback'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'fan',
    synonyms: ['supporter', 'follower', 'devotee', 'enthusiast', 'admirer', 'patron', 'backer'],
    confidence: 0.95,
    context: 'supporter',
    partOfSpeech: 'noun'
  },
  {
    word: 'fan',
    synonyms: ['blower', 'ventilator', 'air circulator', 'impeller'],
    confidence: 0.9,
    context: 'appliance',
    partOfSpeech: 'noun'
  },
  {
    word: 'supporter',
    synonyms: ['fan', 'backer', 'patron', 'advocate', 'follower', 'ally'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'leaderboard',
    synonyms: ['ranking', "standings", "scoreboard", "ladder", "rankings", "table"],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'ranking',
    synonyms: ['standings', 'leaderboard', 'position', 'tier', 'grade', 'order'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'club',
    synonyms: ['team', 'guild', 'circle', 'association', 'stable', 'group', 'society'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'member',
    synonyms: ['participant', 'teammate', 'player', 'associate', 'partner', 'comrade'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'track',
    synonyms: ['course', 'turf', 'dirt', 'circuit', 'lane', 'pathway', 'raceway'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'course',
    synonyms: ['track', 'circuit', 'route', 'path', 'raceway'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'build',
    synonyms: ['loadout', 'setup', 'configuration', 'stat distribution', 'structure', 'template'],
    confidence: 0.9,
    partOfSpeech: 'noun'
  },
  {
    word: 'strategy',
    synonyms: ['tactics', 'approach', 'plan', 'scheme', 'method', 'system', 'policy'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'plan',
    synonyms: ['strategy', 'scheme', 'blueprint', 'schedule', 'design', 'method'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'good',
    synonyms: ['great', 'fine', 'excellent', 'superior', 'prime', 'favorable', 'stellar'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'bad',
    synonyms: ['poor', 'inferior', 'subpar', 'unfavorable', 'flawed', 'terrible', 'deficient'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'strong',
    synonyms: ['powerful', 'robust', 'tough', 'mighty', 'resilient', 'forceful', 'potent'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'weak',
    synonyms: ['fragile', 'feeble', 'vulnerable', 'poor', 'inadequate', 'frail'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'smart',
    synonyms: ['intelligent', 'clever', 'wise', 'sharp', 'astute', 'bright', 'savvy'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'help',
    synonyms: ['assist', 'support', 'aid', 'guide', 'succor', 'facilitate', 'back'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'assist',
    synonyms: ['help', 'aid', 'support', 'serve', 'facilitate'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'front runner',
    synonyms: ['escape', 'leader', 'pacesetter', 'frontrunner', 'spearhead'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'leader',
    synonyms: ['front runner', 'pacesetter', 'chief', 'head', 'commander', 'captain'],
    confidence: 0.9,
    partOfSpeech: 'noun'
  },
  {
    word: 'advice',
    synonyms: ['recommendation', 'guidance', 'counsel', 'suggestion', 'tip', 'instruction'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'recommendation',
    synonyms: ['advice', 'suggestion', 'guidance', 'proposal', 'endorsement'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  }
];

export class SynonymLoader {
  /**
   * Loads core synonyms dataset and populates a new SynonymRegistry.
   */
  public static load(customData: SynonymEntry[] = DEFAULT_CORE_SYNONYMS): SynonymRegistry {
    const registry = new SynonymRegistry();
    for (const entry of customData) {
      registry.register(entry);
    }
    return registry;
  }

  /**
   * Loads synonyms from a JSON string.
   */
  public static loadFromJson(jsonString: string): SynonymRegistry {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid synonyms JSON: expected array of SynonymEntry');
    }
    return this.load(parsed as SynonymEntry[]);
  }

  /**
   * Loads synonyms from a file path on disk, falling back to DEFAULT_CORE_SYNONYMS.
   */
  public static loadFromFile(filePath?: string): SynonymRegistry {
    if (filePath && fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.loadFromJson(content);
      } catch {
        // Fallback to default
      }
    }
    return this.load();
  }
}
