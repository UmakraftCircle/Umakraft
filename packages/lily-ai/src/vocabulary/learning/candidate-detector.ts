import { CandidateCategory, LearningPolicy, DEFAULT_LEARNING_POLICY } from './learning-policy.js';
import { LilyVocabularyProvider } from '../lily-vocabulary-provider.js';
import { DictionaryKnowledgeProvider } from '../dictionary/dictionary-provider.js';
import { DefinitionKnowledgeProvider } from '../definitions/definition-provider.js';
import { TaxonomyKnowledgeProvider } from '../../knowledge/providers/taxonomy/taxonomy-provider.js';
import { GlossaryService } from '../../language-core/glossary/glossary-service.js';

export interface DetectedCandidateToken {
  term: string;
  contextSentence: string;
  category: CandidateCategory;
  plausible: boolean;
  noiseReason?: string;
}

const COMMON_STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'is', 'are', 'was', 'were', 'been', 'being', 'am', 'has', 'had', 'having',
  'did', 'does', 'doing', 'done', 'should', 'must', 'might', 'may', 'shall',
  'very', 'much', 'too', 'more', 'less', 'why', 'where', 'here', 'such', 'own',
  'same', 'each', 'both', 'few', 'while', 'let', 'show', 'tell', 'ask', 'try'
]);

const COMMUNITY_PATTERNS = [
  'uma', 'umamusume', 'g1', 'g2', 'g3', 'fan', 'fans', 'spark', 'sparks', 'fanzone',
  'debuff', 'debuffs', 'inherit', 'inheritance', 'deck', 'guts', 'stamina', 'wisdom',
  'spurt', 'proctor', 'poggers', 'wip', 'gg', 'ggs', 'gl', 'hf', 'smh', 'idk', 'tbh',
  'buff', 'nerf', 'meta', 'clutch', 'midrace', 'endrace', 'op', 'reroll', 'cl'
];

export class CandidateDetector {
  private policy: LearningPolicy;
  private vocabularyProvider: LilyVocabularyProvider;
  private dictionaryProvider: DictionaryKnowledgeProvider;
  private definitionProvider: DefinitionKnowledgeProvider;
  private taxonomyProvider: TaxonomyKnowledgeProvider;
  private glossaryService: GlossaryService;

  constructor(
    policy: LearningPolicy = DEFAULT_LEARNING_POLICY,
    vocabularyProvider?: LilyVocabularyProvider,
    dictionaryProvider?: DictionaryKnowledgeProvider,
    definitionProvider?: DefinitionKnowledgeProvider,
    taxonomyProvider?: TaxonomyKnowledgeProvider,
    glossaryService?: GlossaryService
  ) {
    this.policy = policy;
    this.vocabularyProvider = vocabularyProvider || new LilyVocabularyProvider();
    this.dictionaryProvider = dictionaryProvider || new DictionaryKnowledgeProvider();
    this.definitionProvider = definitionProvider || new DefinitionKnowledgeProvider();
    this.taxonomyProvider = taxonomyProvider || new TaxonomyKnowledgeProvider();
    this.glossaryService = glossaryService || new GlossaryService();
  }

  /**
   * Scans a text for unknown words that are candidates for learning.
   */
  public detect(text: string): DetectedCandidateToken[] {
    if (!text || typeof text !== 'string') return [];

    const raw = text.trim();
    if (raw.length === 0) return [];

    // Check blacklisted global patterns
    for (const pattern of this.policy.blacklistedPatterns) {
      if (raw.includes(pattern)) {
        // Skip or sanitize
      }
    }

    // Split text into sentences and tokens
    const sentences = raw.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    const results: DetectedCandidateToken[] = [];
    const seenTerms = new Set<string>();

    for (const sentence of sentences) {
      // Tokenize by non-alphanumeric (allowing hyphen and underscore for compounds)
      const rawTokens = sentence.split(/[^a-zA-Z0-9_\-]+/);

      for (const rawToken of rawTokens) {
        const token = rawToken.trim().toLowerCase();

        if (token.length < this.policy.minTokenLength || token.length > this.policy.maxTokenLength) {
          continue;
        }

        if (seenTerms.has(token)) {
          continue;
        }

        // 1. Filter pure numbers or hexadecimal
        if (/^[0-9]+$/.test(token) || /^0x[0-9a-f]+$/i.test(token)) {
          continue;
        }

        // 2. Filter common English stop words
        if (COMMON_STOP_WORDS.has(token)) {
          continue;
        }

        // 3. Known in Core Vocabulary?
        if (this.vocabularyProvider.lookupWord(token)) {
          continue;
        }

        // 4. Known in Active Dictionary?
        if (this.dictionaryProvider.exists(token)) {
          continue;
        }

        // 4. Known in Active Definition Provider?
        if (this.definitionProvider.exists(token)) {
          continue;
        }

        // 5. Known in Taxonomy?
        if (this.taxonomyProvider.findByName(token) || this.taxonomyProvider.findByAlias(token) || this.taxonomyProvider.findById(token)) {
          continue;
        }

        // 6. Known in Glossary?
        if (this.glossaryService.lookup(token)) {
          continue;
        }

        // Word is UNKNOWN! Now perform linguistic plausibility check.
        const plausibility = this.checkPlausibility(token);
        const category = this.inferCategory(token, sentence);

        seenTerms.add(token);
        results.push({
          term: token,
          contextSentence: sentence,
          category,
          plausible: plausibility.plausible,
          noiseReason: plausibility.reason
        });
      }
    }

    return results;
  }

  /**
   * Checks if an unknown token looks like real language vs keyboard mash/gibberish.
   */
  public checkPlausibility(token: string): { plausible: boolean; reason?: string } {
    // 1. Repeated identical characters (e.g. "aaaaaa", "zzzzz")
    if (/(.)\1{3,}/.test(token)) {
      return { plausible: false, reason: 'Repeated character sequence' };
    }

    // 2. Keyboard mash patterns (e.g., asdfgh, zxcvbn, qwert)
    const keyboardRows = [
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
      'qazwsxedc',
      '1234567890'
    ];
    for (const row of keyboardRows) {
      if (token.length >= 5 && row.includes(token)) {
        return { plausible: false, reason: 'Keyboard sequence mash' };
      }
    }

    // 3. Vowel / Consonant ratio for words > 4 characters
    const vowels = (token.match(/[aeiouy]/gi) || []).length;
    const consonants = (token.match(/[bcdfghjklmnpqrstvwxz]/gi) || []).length;
    const totalLetters = vowels + consonants;

    if (totalLetters >= 5) {
      if (vowels === 0) {
        // e.g., "xjzqqw", "sdfghj" (unless common community acronyms like "brb", "smh", "wip")
        if (!COMMUNITY_PATTERNS.includes(token)) {
          return { plausible: false, reason: 'Zero vowels in multi-letter word' };
        }
      }

      const vowelRatio = vowels / totalLetters;
      if (vowelRatio > 0.85 || vowelRatio < 0.12) {
        return { plausible: false, reason: 'Abnormal vowel to consonant ratio' };
      }
    }

    return { plausible: true };
  }

  /**
   * Categorizes the unknown term into domain, community, slang, or general.
   */
  public inferCategory(term: string, contextSentence: string): CandidateCategory {
    const sLower = contextSentence.toLowerCase();
    const tLower = term.toLowerCase();

    // Check community & racing keywords in sentence
    if (
      sLower.includes('race') ||
      sLower.includes('trainer') ||
      sLower.includes('club') ||
      sLower.includes('stat') ||
      sLower.includes('build') ||
      sLower.includes('inherit') ||
      sLower.includes('spark') ||
      sLower.includes('fans') ||
      sLower.includes('g1') ||
      sLower.includes('uma')
    ) {
      if (tLower.length <= 4 && /^[a-z0-9]+$/.test(tLower)) {
        return 'shorthand';
      }
      return 'community';
    }

    // Slang checks
    if (
      sLower.includes('lol') ||
      sLower.includes('pog') ||
      sLower.includes('hype') ||
      sLower.includes('meme') ||
      sLower.includes('bro') ||
      sLower.includes('lmao') ||
      tLower.endsWith('ers') ||
      tLower.endsWith('ing')
    ) {
      return 'slang';
    }

    return 'general';
  }
}
