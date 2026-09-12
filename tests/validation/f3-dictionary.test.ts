import { test } from 'node:test';
import assert from 'node:assert';
import {
  DictionaryService,
  VocabularyCategory,
  LanguageCoreService
} from '../../packages/lily-ai/src/language-core/index.js';

test('F3 — Dictionary System & Vocabulary Categories', async (t) => {
  const dictionaryService = new DictionaryService();
  const coreService = new LanguageCoreService();

  await t.test('F3.1 Seeding & Categories Verification', () => {
    // Core English
    assert.ok(dictionaryService.hasWord('need', VocabularyCategory.CORE_ENGLISH));
    assert.ok(dictionaryService.hasWord('parent', VocabularyCategory.CORE_ENGLISH));

    // Umakraft Operational
    assert.ok(dictionaryService.hasWord('link', VocabularyCategory.UMAKRAFT));
    assert.ok(dictionaryService.hasWord('milestone', VocabularyCategory.UMAKRAFT));

    // Umamusume Taxonomy
    assert.ok(dictionaryService.hasWord('speed', VocabularyCategory.UMAMUSUME));
    assert.ok(dictionaryService.hasWord('tokyo', VocabularyCategory.UMAMUSUME));
    assert.ok(dictionaryService.hasWord('kitasan black', VocabularyCategory.UMAMUSUME));
  });

  await t.test('F3.2 Category Partition Search', () => {
    const umamusumeTerms = dictionaryService.searchCategory(VocabularyCategory.UMAMUSUME);
    assert.ok(umamusumeTerms.length > 0);
    assert.ok(umamusumeTerms.some(e => e.word === 'speed'));

    // Searching 'need' in UMAMUSUME should return false/undefined
    assert.strictEqual(dictionaryService.hasWord('need', VocabularyCategory.UMAMUSUME), false);
    assert.strictEqual(dictionaryService.lookup('need', VocabularyCategory.UMAMUSUME), undefined);
  });

  await t.test('F3.3 Unknown Word Tracking & Frequency Analysis', async () => {
    const tracker = coreService.getUnknownWordTracker();
    tracker.clear();

    // Analyze some texts containing unknown words
    await coreService.analyze('poggers word of the day');
    await coreService.analyze('poggers again');

    const records = tracker.getRecords();
    const poggersRecord = tracker.getRecord('poggers');

    assert.ok(poggersRecord);
    assert.strictEqual(poggersRecord.count, 2);
    assert.ok(records[0].word === 'poggers' || records[0].word === 'again' || records[0].word === 'word' || records[0].word === 'day');
  });

  await t.test('F3.4 Review & Word Promotion Mechanism', () => {
    const tracker = coreService.getUnknownWordTracker();
    const dict = coreService.getDictionaryService();

    const poggersRecord = tracker.getRecord('poggers');
    assert.ok(poggersRecord);

    // Promote the word to Community Slang category
    dict.addEntry({
      word: poggersRecord.word,
      definition: 'expressing high excitement or satisfaction',
      partOfSpeech: 'slang',
      category: VocabularyCategory.COMMUNITY_SLANG,
      synonyms: ['awesome', 'hype'],
      examples: ['This run was poggers!']
    });

    // Now it should be inside the dictionary
    assert.ok(dict.hasWord('poggers', VocabularyCategory.COMMUNITY_SLANG));
    assert.strictEqual(dict.lookup('poggers')?.category, VocabularyCategory.COMMUNITY_SLANG);
  });
});
