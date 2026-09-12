import { test } from 'node:test';
import assert from 'node:assert';
import {
  LilyVocabularyProvider,
  VocabularyRegistry,
  VocabularyLoader,
  VocabularySearch,
  VocabularyNormalizer,
  VocabularyCache,
  VocabularyValidator,
  DEFAULT_CORE_VOCABULARY
} from '../../packages/lily-ai/src/vocabulary/index.js';
import { KnowledgeEngine } from '../../packages/lily-ai/src/knowledge/knowledge-engine.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/knowledge/lily-knowledge-service.js';

test('F13 — Vocabulary Foundation Provider', async (t) => {
  await t.test('1. VocabularyRegistry stores entries with valid parts of speech', () => {
    const registry = new VocabularyRegistry();
    registry.register({
      word: 'testword',
      definition: 'a word used for testing',
      partOfSpeech: 'noun',
      language: 'en'
    });

    assert.strictEqual(registry.has('testword'), true);
    assert.strictEqual(registry.has('TESTWORD'), true);
    const entry = registry.get('testword');
    assert.ok(entry);
    assert.strictEqual(entry.partOfSpeech, 'noun');
    assert.strictEqual(registry.getByPartOfSpeech('noun').length, 1);
    assert.strictEqual(registry.count(), 1);
  });

  await t.test('2. VocabularyLoader loads core vocabulary dataset with high quality definitions', () => {
    const registry = VocabularyLoader.load();
    assert.ok(registry.count() >= 70, `Expected at least 70 entries, got ${registry.count()}`);

    const runner = registry.get('runner');
    assert.ok(runner);
    assert.strictEqual(runner.definition, 'a person or thing that runs');
    assert.strictEqual(runner.partOfSpeech, 'noun');

    const fast = registry.get('fast');
    assert.ok(fast);
    assert.strictEqual(fast.partOfSpeech, 'adjective');

    const run = registry.get('run');
    assert.ok(run);
    assert.strictEqual(run.partOfSpeech, 'verb');
  });

  await t.test('3. VocabularyNormalizer normalizes casing, whitespace, and inflected forms', () => {
    // Case & whitespace
    assert.strictEqual(VocabularyNormalizer.normalize('Runner').normalized, 'runner');
    assert.strictEqual(VocabularyNormalizer.normalize('RUNNER').normalized, 'runner');
    assert.strictEqual(VocabularyNormalizer.normalize('  runner  ').normalized, 'runner');

    // Inflected forms -> lemma
    assert.strictEqual(VocabularyNormalizer.normalize('RUNNING').normalized, 'run');
    assert.strictEqual(VocabularyNormalizer.normalize('running').normalized, 'run');
    assert.strictEqual(VocabularyNormalizer.normalize('runs').normalized, 'run');
    assert.strictEqual(VocabularyNormalizer.normalize('ran').normalized, 'run');

    // Other irregulars and comparatives
    assert.strictEqual(VocabularyNormalizer.normalize('winning').normalized, 'win');
    assert.strictEqual(VocabularyNormalizer.normalize('won').normalized, 'win');
    assert.strictEqual(VocabularyNormalizer.normalize('faster').normalized, 'fast');
    assert.strictEqual(VocabularyNormalizer.normalize('fastest').normalized, 'fast');
    assert.strictEqual(VocabularyNormalizer.normalize('slower').normalized, 'slow');
    assert.strictEqual(VocabularyNormalizer.normalize('players').normalized, 'player');
    assert.strictEqual(VocabularyNormalizer.normalize('games').normalized, 'game');
  });

  await t.test('4. VocabularySearch supports exact match, prefix, substring, and ranking', () => {
    const registry = VocabularyLoader.load();
    const search = new VocabularySearch(registry);

    // Exact
    const exact = search.findWord('runner');
    assert.ok(exact);
    assert.strictEqual(exact.word, 'runner');
    assert.strictEqual(exact.confidence, 1.0);

    // Lemmatized match (e.g. looking up 'running' resolves to 'run')
    const lemmatized = search.findWord('running');
    assert.ok(lemmatized);
    assert.strictEqual(lemmatized.word, 'run');
    assert.strictEqual(lemmatized.normalized, 'run');

    // Prefix search
    const prefixMatches = search.startsWith('co', 5);
    assert.ok(prefixMatches.length > 0);
    assert.ok(prefixMatches.some(m => m.word.startsWith('co')));

    // Substring contains
    const containsMatches = search.contains('run', 10);
    assert.ok(containsMatches.length >= 2);
    assert.ok(containsMatches.some(m => m.word === 'run'));
    assert.ok(containsMatches.some(m => m.word === 'runner'));

    // Search ranking with limit
    const searchResults = search.search('buff', { limit: 3 });
    assert.ok(searchResults.length > 0);
    assert.strictEqual(searchResults[0].word, 'buff');
  });

  await t.test('5. VocabularyValidator detects errors and validates dataset integrity', () => {
    // Valid dataset check
    const validRegistry = VocabularyLoader.load();
    const validReport = VocabularyValidator.validate(validRegistry);
    assert.strictEqual(validReport.valid, true);
    assert.strictEqual(validReport.errors.length, 0);

    // Invalid dataset check
    const invalidRegistry = new VocabularyRegistry();
    invalidRegistry.register({
      word: '',
      definition: 'empty word test',
      partOfSpeech: 'noun',
      language: 'en'
    });
    invalidRegistry.register({
      word: 'nodef',
      definition: '',
      partOfSpeech: 'noun',
      language: 'en'
    });
    invalidRegistry.register({
      word: 'badpos',
      definition: 'invalid pos test',
      partOfSpeech: 'not_a_valid_pos',
      language: 'en'
    });
    invalidRegistry.register({
      word: 'duplicate',
      definition: 'first',
      partOfSpeech: 'noun',
      language: 'en'
    });
    invalidRegistry.register({
      word: 'duplicate',
      definition: 'second',
      partOfSpeech: 'verb',
      language: 'en'
    });

    const invalidReport = VocabularyValidator.validate(invalidRegistry);
    assert.strictEqual(invalidReport.valid, false);
    assert.ok(invalidReport.errors.length >= 4);
  });

  await t.test('6. VocabularyCache prewarms popular words and provides fast lookup', () => {
    const cache = new VocabularyCache();
    cache.prewarm(DEFAULT_CORE_VOCABULARY);

    assert.ok(cache.size() > 10);
    assert.strictEqual(cache.has('word:runner'), true);
    assert.strictEqual(cache.has('word:fast'), true);
    assert.strictEqual(cache.has('word:meta'), true);

    const runner = cache.get<any>('word:runner');
    assert.ok(runner);
    assert.strictEqual(runner.word, 'runner');
    assert.strictEqual(runner.definition, 'a person or thing that runs');
  });

  await t.test('7. LilyVocabularyProvider exposes authoritative vocabulary lookup & normalization API', () => {
    const provider = new LilyVocabularyProvider();

    // Verify startup validation passed
    assert.strictEqual(provider.getValidationReport().valid, true);

    // What does "runner" mean?
    const runner = provider.lookupWord('runner');
    assert.ok(runner);
    assert.strictEqual(runner.word, 'runner');
    assert.strictEqual(runner.definition, 'a person or thing that runs');
    assert.strictEqual(runner.partOfSpeech, 'noun');

    // What does "fast" mean?
    const fast = provider.lookupWord('fast');
    assert.ok(fast);
    assert.strictEqual(fast.partOfSpeech, 'adjective');

    // Normalizer API
    const norm = provider.normalize('RUNNING');
    assert.strictEqual(norm.normalized, 'run');
    assert.strictEqual(norm.original, 'RUNNING');

    // Priority check
    assert.strictEqual(provider.priority, 50);
  });

  await t.test('8. KnowledgeEngine integration & authority ranking: Taxonomy wins for Umamusume, Vocabulary answers language', async () => {
    const engine = new KnowledgeEngine();

    // 1. Vocabulary query for "runner"
    const runnerResults = await engine.query({ term: 'runner' });
    assert.ok(runnerResults.length > 0);
    assert.ok(runnerResults.some(r => r.source === 'vocabulary'));

    // 2. Umamusume terminology query: "Front Runner"
    // Taxonomy (authority 100) must rank ABOVE Vocabulary (authority 50)
    const frontRunnerResults = await engine.query({ term: 'Front Runner' });
    assert.ok(frontRunnerResults.length > 0);
    const topResult = frontRunnerResults[0];
    assert.strictEqual(topResult.source, 'taxonomy');
    assert.strictEqual(topResult.authority, 100);

    // Check that vocabulary provider also exists in results with authority 50
    const vocabResult = frontRunnerResults.find(r => r.source === 'vocabulary');
    if (vocabResult) {
      assert.strictEqual(vocabResult.authority, 50);
      assert.ok(topResult.authority > vocabResult.authority);
    }
  });

  await t.test('9. LilyKnowledgeService integration query for vocabulary terms', async () => {
    const service = new LilyKnowledgeService();

    const result = await service.resolve({ term: 'runner' });
    assert.ok(result.length > 0);
    const vocabItem = result.find(r => r.source === 'vocabulary');
    assert.ok(vocabItem);
    assert.strictEqual(vocabItem.authority, 50);

    // Query alias
    const queryResult = await service.query({ term: 'fast' });
    assert.ok(queryResult.length > 0);
    const fastItem = queryResult.find(r => r.source === 'vocabulary');
    assert.ok(fastItem);
  });
});
