import { test } from 'node:test';
import assert from 'node:assert';
import {
  DictionaryKnowledgeProvider,
  DictionaryRegistry,
  DictionaryLoader,
  DictionaryLookupEngine,
  DictionarySearch,
  DictionaryNormalizer,
  DictionaryCache,
  DictionaryConfidenceEngine,
  DictionaryConfidenceLevel,
  DictionaryValidator,
  DEFAULT_CORE_DICTIONARY
} from '../../packages/lily-ai/src/vocabulary/index.js';
import { KnowledgeEngine } from '../../packages/lily-ai/src/knowledge/knowledge-engine.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/knowledge/lily-knowledge-service.js';

test('F14 — Dictionary Knowledge Provider', async (t) => {
  await t.test('F14.1 & F14.2: DictionaryEntry model and DictionaryRegistry indexing', () => {
    const registry = new DictionaryRegistry();
    registry.register({
      word: 'diligent',
      normalizedWord: 'diligent',
      partOfSpeech: 'adjective',
      definitions: [
        'showing steady, earnest, and energetic effort in completing tasks',
        'painstakingly attentive and careful in study or work'
      ],
      examples: [
        'She is a diligent trainee who never misses practice.'
      ],
      aliases: ['industrious', 'hardworking'],
      confidence: 1.00
    });

    assert.strictEqual(registry.has('diligent'), true);
    assert.strictEqual(registry.has('DILIGENT'), true);
    assert.strictEqual(registry.has('industrious'), true); // alias lookup

    const entry = registry.get('diligent');
    assert.ok(entry);
    assert.strictEqual(entry.word, 'diligent');
    assert.strictEqual(entry.partOfSpeech, 'adjective');
    assert.strictEqual(entry.definitions.length, 2);
    assert.strictEqual(entry.confidence, 1.00);

    const adjectiveList = registry.getByPartOfSpeech('adjective');
    assert.strictEqual(adjectiveList.length, 1);
    assert.strictEqual(registry.count(), 1);
  });

  await t.test('F14.3: DictionaryLookupEngine direct and normalized lookups', () => {
    const registry = DictionaryLoader.load();
    const lookupEngine = new DictionaryLookupEngine(registry);

    // Direct lookup for 'diligent'
    const diligentRes = lookupEngine.lookup('diligent');
    assert.strictEqual(diligentRes.found, true);
    if (diligentRes.found) {
      assert.strictEqual(diligentRes.word, 'diligent');
      assert.strictEqual(diligentRes.partOfSpeech, 'adjective');
      assert.ok(diligentRes.definitions.length >= 1);
      assert.strictEqual(diligentRes.confidence, 1.00);
    }

    // Direct lookup for 'run'
    const runRes = lookupEngine.lookup('run');
    assert.strictEqual(runRes.found, true);
    if (runRes.found) {
      assert.strictEqual(runRes.partOfSpeech, 'verb');
      assert.ok(runRes.definitions.length >= 2);
    }
  });

  await t.test('F14.4: Morphological Resolution handles irregulars, tenses, comparatives, and suffixes', () => {
    // 1. Irregulars
    assert.strictEqual(DictionaryNormalizer.normalize('running').normalized, 'run');
    assert.strictEqual(DictionaryNormalizer.normalize('runs').normalized, 'run');
    assert.strictEqual(DictionaryNormalizer.normalize('ran').normalized, 'run');
    assert.strictEqual(DictionaryNormalizer.normalize('better').normalized, 'good');
    assert.strictEqual(DictionaryNormalizer.normalize('best').normalized, 'good');
    assert.strictEqual(DictionaryNormalizer.normalize('worse').normalized, 'bad');
    assert.strictEqual(DictionaryNormalizer.normalize('worst').normalized, 'bad');
    assert.strictEqual(DictionaryNormalizer.normalize('studies').normalized, 'study');
    assert.strictEqual(DictionaryNormalizer.normalize('studying').normalized, 'study');
    assert.strictEqual(DictionaryNormalizer.normalize('studied').normalized, 'study');
    assert.strictEqual(DictionaryNormalizer.normalize('won').normalized, 'win');
    assert.strictEqual(DictionaryNormalizer.normalize('winning').normalized, 'win');

    // 2. Regular comparatives & adverbs
    assert.strictEqual(DictionaryNormalizer.normalize('faster').normalized, 'fast');
    assert.strictEqual(DictionaryNormalizer.normalize('fastest').normalized, 'fast');
    assert.strictEqual(DictionaryNormalizer.normalize('slower').normalized, 'slow');
    assert.strictEqual(DictionaryNormalizer.normalize('slowest').normalized, 'slow');
    assert.strictEqual(DictionaryNormalizer.normalize('diligently').normalized, 'diligent');

    // 3. Lookup engine morphological resolution in practice
    const provider = new DictionaryKnowledgeProvider();
    const resolvedRunning = provider.resolve('running');
    assert.strictEqual(resolvedRunning.found, true);
    assert.strictEqual(resolvedRunning.word, 'run');

    const resolvedStudies = provider.resolve('studies');
    assert.strictEqual(resolvedStudies.found, true);
    assert.strictEqual(resolvedStudies.word, 'study');

    const resolvedBetter = provider.resolve('better');
    assert.strictEqual(resolvedBetter.found, true);
    assert.strictEqual(resolvedBetter.word, 'good');
  });

  await t.test('F14.5: Multi-Definition Support for polysemous words (race, train, power, fan, track)', () => {
    const provider = new DictionaryKnowledgeProvider();

    // Word: 'race' has competition and human population definitions
    const raceRes = provider.lookup('race');
    assert.strictEqual(raceRes.found, true);
    if (raceRes.found) {
      assert.ok(raceRes.definitions.length >= 2, 'race should have multiple definitions');
      assert.ok(raceRes.definitions.some(d => d.includes('speed') || d.includes('competition')));
      assert.ok(raceRes.definitions.some(d => d.includes('human') || d.includes('category')));
    }

    // Word: 'train' has skill practice and railway cars definitions
    const trainRes = provider.lookup('train');
    assert.strictEqual(trainRes.found, true);
    if (trainRes.found) {
      assert.ok(trainRes.definitions.length >= 2);
      assert.ok(trainRes.definitions.some(d => d.includes('practice') || d.includes('capabilities')));
      assert.ok(trainRes.definitions.some(d => d.includes('railway') || d.includes('cars')));
    }

    // Word: 'fan' has devotee and electric air blade apparatus definitions
    const fanRes = provider.lookup('fan');
    assert.strictEqual(fanRes.found, true);
    if (fanRes.found) {
      assert.ok(fanRes.definitions.length >= 2);
      assert.ok(fanRes.definitions.some(d => d.includes('devotee') || d.includes('supporter')));
      assert.ok(fanRes.definitions.some(d => d.includes('blades') || d.includes('air')));
    }
  });

  await t.test('F14.6: Usage Examples support', () => {
    const provider = new DictionaryKnowledgeProvider();

    const runRes = provider.lookup('run');
    assert.strictEqual(runRes.found, true);
    if (runRes.found) {
      assert.ok(runRes.examples && runRes.examples.length >= 2);
      assert.ok(runRes.examples.some(e => e.toLowerCase().includes('run')));
    }

    const diligentRes = provider.lookup('diligent');
    assert.strictEqual(diligentRes.found, true);
    if (diligentRes.found) {
      assert.ok(diligentRes.examples && diligentRes.examples.length >= 1);
      assert.ok(diligentRes.examples.some(e => e.toLowerCase().includes('diligent')));
    }
  });

  await t.test('F14.7: DictionaryConfidenceEngine classifications and scoring', () => {
    assert.strictEqual(DictionaryConfidenceEngine.getLevel(1.00), 'curated');
    assert.strictEqual(DictionaryConfidenceEngine.getLevel(0.90), 'verified');
    assert.strictEqual(DictionaryConfidenceEngine.getLevel(0.70), 'candidate');
    assert.strictEqual(DictionaryConfidenceEngine.getLevel(0.50), 'untrusted');

    assert.strictEqual(DictionaryConfidenceEngine.isTrusted(1.00), true);
    assert.strictEqual(DictionaryConfidenceEngine.isTrusted(0.90), true);
    assert.strictEqual(DictionaryConfidenceEngine.isTrusted(0.70), true);
    assert.strictEqual(DictionaryConfidenceEngine.isTrusted(0.69), false);

    // Scoring calculation
    const completeEntry = {
      word: 'sample',
      definitions: ['a valid definition'],
      examples: ['an example usage']
    };
    assert.strictEqual(DictionaryConfidenceEngine.scoreEntry(completeEntry), DictionaryConfidenceLevel.CURATED);
  });

  await t.test('F14.8: DictionaryCache operations, LRU capacity, and prewarm', () => {
    const cache = new DictionaryCache(100, 1000 * 60);
    cache.prewarm(DEFAULT_CORE_DICTIONARY);

    assert.ok(cache.size() >= 20);
    assert.strictEqual(cache.has('word:run'), true);
    assert.strictEqual(cache.has('word:diligent'), true);
    assert.strictEqual(cache.has('word:race'), true);

    const run = cache.get<any>('word:run');
    assert.ok(run);
    assert.strictEqual(run.word, 'run');

    // Test LRU Eviction
    const smallCache = new DictionaryCache(2, 1000 * 60);
    smallCache.set('a', 1);
    smallCache.set('b', 2);
    smallCache.set('c', 3); // should evict 'a'
    assert.strictEqual(smallCache.has('a'), false);
    assert.strictEqual(smallCache.has('b'), true);
    assert.strictEqual(smallCache.has('c'), true);
  });

  await t.test('F14.9: Knowledge Integration & Hierarchy (Taxonomy 100 > Dictionary 75 > Vocabulary 50)', async () => {
    const engine = new KnowledgeEngine();

    // 1. Query for Umamusume term "Front Runner"
    // Taxonomy (100) must rank FIRST over Dictionary (75) and Vocabulary (50)
    const frontRunnerResults = await engine.query({ term: 'Front Runner' });
    assert.ok(frontRunnerResults.length > 0);

    const topResult = frontRunnerResults[0];
    assert.strictEqual(topResult.source, 'taxonomy');
    assert.strictEqual(topResult.authority, 100);

    // Dictionary source presence
    const dictResult = frontRunnerResults.find(r => r.source === 'dictionary');
    if (dictResult) {
      assert.strictEqual(dictResult.authority, 75);
      assert.ok(topResult.authority > dictResult.authority);
    }

    // Vocabulary source presence
    const vocabResult = frontRunnerResults.find(r => r.source === 'vocabulary');
    if (vocabResult) {
      assert.strictEqual(vocabResult.authority, 50);
      if (dictResult) {
        assert.ok(dictResult.authority > vocabResult.authority);
      }
    }

    // 2. Query for common English word "diligent"
    const diligentResults = await engine.query({ term: 'diligent' });
    assert.ok(diligentResults.length > 0);
    const dictDiligent = diligentResults.find(r => r.source === 'dictionary');
    assert.ok(dictDiligent);
    assert.strictEqual(dictDiligent.authority, 75);
    assert.strictEqual(dictDiligent.content.partOfSpeech, 'adjective');
  });

  await t.test('F14.10: Unknown Word Handling returns { status: "unknown_word" }', () => {
    const provider = new DictionaryKnowledgeProvider();

    // Lookup on non-existent gibberish word
    const lookupRes = provider.lookup('asdfghjkl');
    assert.strictEqual(lookupRes.found, false);
    if (!lookupRes.found) {
      assert.strictEqual(lookupRes.status, 'unknown_word');
      assert.strictEqual(lookupRes.word, 'asdfghjkl');
    }

    // Resolve on non-existent gibberish word
    const resolveRes = provider.resolve('qwertyuiopxyz');
    assert.strictEqual(resolveRes.found, false);
    assert.strictEqual(resolveRes.status, 'unknown_word');
    assert.strictEqual(resolveRes.word, 'qwertyuiopxyz');
  });

  await t.test('LilyKnowledgeService integration query for dictionary entries', async () => {
    const service = new LilyKnowledgeService();

    const runQuery = await service.query({ term: 'run' });
    assert.ok(runQuery.length > 0);
    const dictItem = runQuery.find(r => r.source === 'dictionary');
    assert.ok(dictItem);
    assert.strictEqual(dictItem.authority, 75);

    const diligentQuery = await service.resolve({ term: 'diligent' });
    assert.ok(diligentQuery.length > 0);
    const diligentItem = diligentQuery.find(r => r.source === 'dictionary');
    assert.ok(diligentItem);
  });
});
