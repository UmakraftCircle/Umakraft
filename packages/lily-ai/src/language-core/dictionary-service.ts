import { VocabularyCategory } from './dictionary/vocabulary-categories.js';
import { CategorizedDictionaryEntry } from './dictionary/dictionary-entry-model.js';

// Backwards-compatible alias for DictionaryEntry
export interface DictionaryEntry extends CategorizedDictionaryEntry {}

export class DictionaryService {
  private dictionary = new Map<string, CategorizedDictionaryEntry>();

  constructor() {
    // Tier 1 — Core English Vocabulary
    const coreEnglishWords = [
      { word: 'need', partOfSpeech: 'verb', definition: 'require something essential', synonyms: ['require', 'want', 'demand'], examples: ['I need a parent.'] },
      { word: 'help', partOfSpeech: 'verb', definition: 'provide assistance', synonyms: [], examples: [] },
      { word: 'find', partOfSpeech: 'verb', definition: 'discover or locate', synonyms: [], examples: [] },
      { word: 'show', partOfSpeech: 'verb', definition: 'display or present', synonyms: [], examples: [] },
      { word: 'search', partOfSpeech: 'verb', definition: 'look for something', synonyms: [], examples: [] },
      { word: 'parent', partOfSpeech: 'noun', definition: 'precursor lineage in breeding', synonyms: ['ancestor', 'progenitor', 'lineage'], examples: ['Need long runner parent'] },
      { word: 'guide', partOfSpeech: 'noun', definition: 'instructive handbook or layout', synonyms: [], examples: [] },
      { word: 'leaderboard', partOfSpeech: 'noun', definition: 'score board of top members', synonyms: [], examples: [] },
      { word: 'member', partOfSpeech: 'noun', definition: 'individual belonging to a club', synonyms: [], examples: [] },
      { word: 'club', partOfSpeech: 'noun', definition: 'association of trainers', synonyms: [], examples: [] },
      { word: 'fan', partOfSpeech: 'noun', definition: 'supporters or audience in training', synonyms: [], examples: [] },
      { word: 'goal', partOfSpeech: 'noun', definition: 'target or milestone objective', synonyms: [], examples: [] },
      { word: 'race', partOfSpeech: 'noun', definition: 'track running competition', synonyms: [], examples: [] },
      { word: 'track', partOfSpeech: 'noun', definition: 'specific running field', synonyms: [], examples: [] },
      { word: 'skill', partOfSpeech: 'noun', definition: 'acquired ability or factor', synonyms: [], examples: [] },
      { word: 'character', partOfSpeech: 'noun', definition: 'specific playable horse girl', synonyms: [], examples: [] },
      { word: 'build', partOfSpeech: 'noun', definition: 'set of stats, factors, or skills', synonyms: ['setup', 'strategy'], examples: ['Oguri Cap build'] },
      { word: 'training', partOfSpeech: 'noun', definition: 'action of training stats', synonyms: [], examples: [] },
      { word: 'support', partOfSpeech: 'noun', definition: 'cards providing stat multiplier benefits', synonyms: [], examples: [] },
      { word: 'factor', partOfSpeech: 'noun', definition: 'heritable breeding components', synonyms: [], examples: [] }
    ];

    for (const item of coreEnglishWords) {
      this.addEntry({
        word: item.word,
        definition: item.definition,
        partOfSpeech: item.partOfSpeech,
        category: VocabularyCategory.CORE_ENGLISH,
        synonyms: item.synonyms,
        examples: item.examples
      });
    }

    // Common stop words / helper words
    const helpers = ['and', 'with', 'for', 'the', 'a', 'to', 'in', 'is', 'of', 'me', 'can', 'you'];
    for (const h of helpers) {
      this.addEntry({
        word: h,
        definition: 'grammatical particle',
        partOfSpeech: 'particle',
        category: VocabularyCategory.CORE_ENGLISH,
        synonyms: [],
        examples: []
      });
    }

    // Tier 2 — Umakraft Operational Vocabulary
    const umakraftWords = [
      'link', 'unlink', 'request', 'approval', 'officer', 'leader', 'trainer',
      'contribution', 'milestone', 'deficit', 'surplus', 'announcement', 'report'
    ];
    for (const w of umakraftWords) {
      this.addEntry({
        word: w,
        definition: 'Umakraft platform operational terminology',
        partOfSpeech: 'noun',
        category: VocabularyCategory.UMAKRAFT,
        synonyms: [],
        examples: []
      });
    }

    // Tier 3 — Umamusume Taxonomy Vocabulary
    const umamusumeWords = [
      'front runner', 'pace chaser', 'late surger', 'end closer',
      'speed', 'stamina', 'power', 'guts', 'wit', 'wisdom',
      'turf', 'dirt', 'sprint', 'mile', 'medium', 'long',
      'oguri cap', 'kitasan black', 'symboli rudolf', 'gold ship',
      'concentration', 'corner adept', 'tokyo', 'nakayama', 'hanshin', 'kyoto'
    ];
    for (const w of umamusumeWords) {
      this.addEntry({
        word: w,
        definition: 'Umamusume taxonomy specific terms',
        partOfSpeech: 'noun',
        category: VocabularyCategory.UMAMUSUME,
        synonyms: [],
        examples: []
      });
    }
  }

  public addEntry(entry: CategorizedDictionaryEntry): void {
    this.dictionary.set(entry.word.toLowerCase(), entry);
  }

  public lookup(word: string, category?: VocabularyCategory): CategorizedDictionaryEntry | undefined {
    const entry = this.dictionary.get(word.toLowerCase());
    if (entry && category && entry.category !== category) {
      return undefined;
    }
    return entry;
  }

  public hasWord(word: string, category?: VocabularyCategory): boolean {
    const entry = this.dictionary.get(word.toLowerCase());
    if (!entry) return false;
    if (category && entry.category !== category) return false;
    return true;
  }

  /**
   * Search within a specific vocabulary category
   */
  public searchCategory(category: VocabularyCategory): CategorizedDictionaryEntry[] {
    return Array.from(this.dictionary.values()).filter(entry => entry.category === category);
  }
}
