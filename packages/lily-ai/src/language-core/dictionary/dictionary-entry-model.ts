import { VocabularyCategory } from './vocabulary-categories.js';

export interface CategorizedDictionaryEntry {
  word: string;
  definition: string;
  partOfSpeech: string;
  category: VocabularyCategory;
  synonyms: string[];
  examples: string[];
}
