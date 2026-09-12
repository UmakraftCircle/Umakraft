import { AntonymRegistry } from './antonym-registry.js';
import { AntonymEntry } from './antonym-entry.js';
import * as fs from 'fs';

export const DEFAULT_CORE_ANTONYMS: AntonymEntry[] = [
  // --- Competition & Outcomes ---
  {
    word: 'win',
    antonyms: ['lose', 'fail', 'forfeit'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'lose',
    antonyms: ['win', 'triumph', 'prevail'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'victory',
    antonyms: ['defeat', 'loss', 'failure'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'defeat',
    antonyms: ['victory', 'triumph', 'win'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'success',
    antonyms: ['failure', 'flop', 'loss'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'failure',
    antonyms: ['success', 'triumph', 'achievement'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'pass',
    antonyms: ['fail', 'flunk'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'fail',
    antonyms: ['pass', 'succeed', 'win'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'winner',
    antonyms: ['loser', 'runner-up'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'loser',
    antonyms: ['winner', 'champion', 'victor'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'gain',
    antonyms: ['loss', 'reduction', 'drop', 'deficit'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'loss',
    antonyms: ['gain', 'profit', 'increase', 'surplus'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'advantage',
    antonyms: ['disadvantage', 'handicap', 'drawback'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'disadvantage',
    antonyms: ['advantage', 'edge', 'benefit'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },

  // --- Requirements & Status ---
  {
    word: 'met',
    antonyms: ['unmet', 'not met', 'failed', 'unsatisfied'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'unmet',
    antonyms: ['met', 'satisfied', 'fulfilled', 'achieved'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'satisfied',
    antonyms: ['unsatisfied', 'unmet', 'discontent'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'complete',
    antonyms: ['incomplete', 'partial', 'unfinished'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'incomplete',
    antonyms: ['complete', 'whole', 'finished'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'valid',
    antonyms: ['invalid', 'void', 'null'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'invalid',
    antonyms: ['valid', 'legitimate', 'sound'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'active',
    antonyms: ['inactive', 'dormant', 'idle', 'passive'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'inactive',
    antonyms: ['active', 'operational', 'engaged'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'enable',
    antonyms: ['disable', 'deactivate', 'prevent'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'disable',
    antonyms: ['enable', 'activate', 'allow'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'compatible',
    antonyms: ['incompatible', 'conflicting', 'mismatched'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'incompatible',
    antonyms: ['compatible', 'harmonious', 'matched'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'consistent',
    antonyms: ['inconsistent', 'contradictory', 'conflicting', 'irregular'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'inconsistent',
    antonyms: ['consistent', 'coherent', 'uniform'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'sufficient',
    antonyms: ['insufficient', 'inadequate', 'lacking'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'insufficient',
    antonyms: ['sufficient', 'adequate', 'enough', 'ample'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'required',
    antonyms: ['optional', 'voluntary', 'elective'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'optional',
    antonyms: ['required', 'mandatory', 'compulsory'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'present',
    antonyms: ['absent', 'missing', 'lacking'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'absent',
    antonyms: ['present', 'attending', 'existing'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },

  // --- Dynamic Changes, Movements & Trends ---
  {
    word: 'increase',
    antonyms: ['decrease', 'reduce', 'drop', 'lower', 'diminish', 'fall'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'decrease',
    antonyms: ['increase', 'raise', 'boost', 'grow', 'elevate', 'rise'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'increased',
    antonyms: ['decreased', 'reduced', 'dropped', 'diminished', 'lowered'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'decreased',
    antonyms: ['increased', 'raised', 'boosted', 'elevated', 'grown'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'rise',
    antonyms: ['fall', 'drop', 'sink', 'descend'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'fall',
    antonyms: ['rise', 'climb', 'ascend', 'increase'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'boost',
    antonyms: ['nerf', 'reduce', 'dampen', 'penalize'],
    confidence: 0.95,
    partOfSpeech: 'verb'
  },
  {
    word: 'nerf',
    antonyms: ['boost', 'buff', 'enhance', 'upgrade'],
    confidence: 0.95,
    partOfSpeech: 'verb'
  },
  {
    word: 'accelerate',
    antonyms: ['decelerate', 'brake', 'slow down'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'decelerate',
    antonyms: ['accelerate', 'speed up', 'quicken'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'improve',
    antonyms: ['deteriorate', 'worsen', 'decline', 'degrade'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'worsen',
    antonyms: ['improve', 'better', 'ameliorate'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'strengthen',
    antonyms: ['weaken', 'undermine', 'dilute'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'weaken',
    antonyms: ['strengthen', 'fortify', 'reinforce'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'lead',
    antonyms: ['trail', 'follow', 'lag'],
    confidence: 1.0,
    context: 'race',
    partOfSpeech: 'verb'
  },
  {
    word: 'lead',
    antonyms: ['follow', 'obey'],
    confidence: 0.95,
    context: 'role',
    partOfSpeech: 'verb'
  },
  {
    word: 'trail',
    antonyms: ['lead', 'head', 'spearhead'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'start',
    antonyms: ['finish', 'end', 'stop', 'conclude'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'finish',
    antonyms: ['start', 'begin', 'commence'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'begin',
    antonyms: ['end', 'cease', 'terminate'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'end',
    antonyms: ['begin', 'start', 'originate'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'enter',
    antonyms: ['exit', 'leave', 'depart'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'exit',
    antonyms: ['enter', 'access', 'join'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },

  // --- Spatial, Relative & Directional ---
  {
    word: 'high',
    antonyms: ['low', 'short'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'low',
    antonyms: ['high', 'elevated', 'tall'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'higher',
    antonyms: ['lower'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'lower',
    antonyms: ['higher'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'maximum',
    antonyms: ['minimum', 'floor'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'minimum',
    antonyms: ['maximum', 'ceiling'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'top',
    antonyms: ['bottom', 'base'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'bottom',
    antonyms: ['top', 'peak', 'apex'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'above',
    antonyms: ['below', 'under', 'beneath'],
    confidence: 1.0,
    partOfSpeech: 'preposition'
  },
  {
    word: 'below',
    antonyms: ['above', 'over'],
    confidence: 1.0,
    partOfSpeech: 'preposition'
  },
  {
    word: 'ahead',
    antonyms: ['behind', 'trailing'],
    confidence: 1.0,
    partOfSpeech: 'adverb'
  },
  {
    word: 'behind',
    antonyms: ['ahead', 'in front'],
    confidence: 1.0,
    partOfSpeech: 'adverb'
  },
  {
    word: 'first',
    antonyms: ['last', 'final'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'last',
    antonyms: ['first', 'initial'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'front',
    antonyms: ['back', 'rear'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'back',
    antonyms: ['front', 'forward'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'up',
    antonyms: ['down'],
    confidence: 1.0,
    partOfSpeech: 'adverb'
  },
  {
    word: 'down',
    antonyms: ['up'],
    confidence: 1.0,
    partOfSpeech: 'adverb'
  },
  {
    word: 'inside',
    antonyms: ['outside', 'exterior'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'outside',
    antonyms: ['inside', 'interior'],
    confidence: 1.0,
    partOfSpeech: 'noun'
  },
  {
    word: 'before',
    antonyms: ['after', 'later'],
    confidence: 1.0,
    partOfSpeech: 'preposition'
  },
  {
    word: 'after',
    antonyms: ['before', 'prior', 'earlier'],
    confidence: 1.0,
    partOfSpeech: 'preposition'
  },

  // --- Attributes, Traits & Stats ---
  {
    word: 'fast',
    antonyms: ['slow', 'sluggish', 'leisurely'],
    confidence: 1.0,
    context: 'speed',
    partOfSpeech: 'adjective'
  },
  {
    word: 'fast',
    antonyms: ['loose', 'unsecured'],
    confidence: 0.9,
    context: 'security',
    partOfSpeech: 'adjective'
  },
  {
    word: 'slow',
    antonyms: ['fast', 'quick', 'rapid', 'swift'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'quick',
    antonyms: ['slow', 'sluggish'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'rapid',
    antonyms: ['slow', 'gradual'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'strong',
    antonyms: ['weak', 'frail', 'feeble', 'vulnerable'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'weak',
    antonyms: ['strong', 'powerful', 'mighty', 'robust'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'heavy',
    antonyms: ['light', 'weightless'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'light',
    antonyms: ['heavy', 'heft', 'burdensome'],
    confidence: 1.0,
    context: 'weight',
    partOfSpeech: 'adjective'
  },
  {
    word: 'light',
    antonyms: ['dark', 'dim', 'shadowy'],
    confidence: 1.0,
    context: 'illumination',
    partOfSpeech: 'adjective'
  },
  {
    word: 'dark',
    antonyms: ['light', 'bright', 'illuminated'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'bright',
    antonyms: ['dim', 'dark', 'dull'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'hard',
    antonyms: ['easy', 'simple', 'effortless'],
    confidence: 1.0,
    context: 'difficulty',
    partOfSpeech: 'adjective'
  },
  {
    word: 'hard',
    antonyms: ['soft', 'yielding', 'pliable'],
    confidence: 1.0,
    context: 'texture',
    partOfSpeech: 'adjective'
  },
  {
    word: 'easy',
    antonyms: ['hard', 'difficult', 'arduous', 'tough'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'difficult',
    antonyms: ['easy', 'simple', 'effortless'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'simple',
    antonyms: ['complex', 'complicated', 'intricate'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'complex',
    antonyms: ['simple', 'basic', 'straightforward'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'good',
    antonyms: ['bad', 'poor', 'terrible', 'inferior'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'bad',
    antonyms: ['good', 'great', 'fine', 'superior'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'best',
    antonyms: ['worst'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'worst',
    antonyms: ['best'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'optimal',
    antonyms: ['suboptimal', 'flawed', 'inferior'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'suboptimal',
    antonyms: ['optimal', 'ideal', 'perfect'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'efficient',
    antonyms: ['inefficient', 'wasteful'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'inefficient',
    antonyms: ['efficient', 'streamlined'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'stable',
    antonyms: ['unstable', 'volatile', 'erratic'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'unstable',
    antonyms: ['stable', 'steady', 'solid'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'safe',
    antonyms: ['dangerous', 'risky', 'hazardous'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'risky',
    antonyms: ['safe', 'secure', 'cautious'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'diligent',
    antonyms: ['lazy', 'careless', 'indolent'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'lazy',
    antonyms: ['diligent', 'hardworking', 'industrious'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'brave',
    antonyms: ['cowardly', 'timid', 'fearful'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'smart',
    antonyms: ['foolish', 'stupid', 'ignorant'],
    confidence: 0.95,
    partOfSpeech: 'adjective'
  },
  {
    word: 'right',
    antonyms: ['left'],
    confidence: 1.0,
    context: 'direction',
    partOfSpeech: 'noun'
  },
  {
    word: 'right',
    antonyms: ['wrong', 'incorrect', 'false'],
    confidence: 1.0,
    context: 'correctness',
    partOfSpeech: 'adjective'
  },
  {
    word: 'left',
    antonyms: ['right'],
    confidence: 1.0,
    context: 'direction',
    partOfSpeech: 'noun'
  },
  {
    word: 'wrong',
    antonyms: ['right', 'correct', 'accurate'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'true',
    antonyms: ['false', 'untrue'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'false',
    antonyms: ['true', 'factual', 'correct'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'positive',
    antonyms: ['negative'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'negative',
    antonyms: ['positive'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'more',
    antonyms: ['less', 'fewer'],
    confidence: 1.0,
    partOfSpeech: 'adverb'
  },
  {
    word: 'less',
    antonyms: ['more', 'greater'],
    confidence: 1.0,
    partOfSpeech: 'adverb'
  },
  {
    word: 'many',
    antonyms: ['few'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'few',
    antonyms: ['many', 'numerous'],
    confidence: 1.0,
    partOfSpeech: 'adjective'
  },
  {
    word: 'all',
    antonyms: ['none', 'nothing'],
    confidence: 1.0,
    partOfSpeech: 'pronoun'
  },
  {
    word: 'none',
    antonyms: ['all', 'everything'],
    confidence: 1.0,
    partOfSpeech: 'pronoun'
  },
  {
    word: 'always',
    antonyms: ['never', 'rarely'],
    confidence: 1.0,
    partOfSpeech: 'adverb'
  },
  {
    word: 'never',
    antonyms: ['always', 'ever'],
    confidence: 1.0,
    partOfSpeech: 'adverb'
  },
  {
    word: 'friend',
    antonyms: ['enemy', 'foe', 'rival'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'enemy',
    antonyms: ['friend', 'ally'],
    confidence: 0.95,
    partOfSpeech: 'noun'
  },
  {
    word: 'add',
    antonyms: ['remove', 'subtract', 'delete'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'remove',
    antonyms: ['add', 'insert', 'attach'],
    confidence: 1.0,
    partOfSpeech: 'verb'
  },
  {
    word: 'careful',
    antonyms: ['careless', 'reckless', 'fast'],
    confidence: 0.30,
    partOfSpeech: 'adjective'
  }
];

export class AntonymLoader {
  /**
   * Loads core antonyms dataset and populates a new AntonymRegistry.
   */
  public static load(customData: AntonymEntry[] = DEFAULT_CORE_ANTONYMS): AntonymRegistry {
    const registry = new AntonymRegistry();
    for (const entry of customData) {
      registry.register(entry);
    }
    return registry;
  }

  /**
   * Loads antonyms from a JSON string.
   */
  public static loadFromJson(jsonString: string): AntonymRegistry {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid antonyms JSON: expected array of AntonymEntry');
    }
    return this.load(parsed as AntonymEntry[]);
  }

  /**
   * Loads antonyms from a file path on disk, falling back to DEFAULT_CORE_ANTONYMS.
   */
  public static loadFromFile(filePath?: string): AntonymRegistry {
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
