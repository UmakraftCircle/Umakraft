import { test } from 'node:test';
import assert from 'node:assert';
import {
  LilySynonymEngine,
  SynonymKnowledgeProvider,
  SynonymRegistry,
  SynonymLoader,
  SynonymResolver,
  SynonymSearch,
  SynonymNormalizer,
  SynonymCache,
  SynonymConfidenceEngine,
  SynonymConfidenceLevel,
  DEFAULT_CORE_SYNONYMS
} from '../../packages/lily-ai/src/vocabulary/index.js';
import { KnowledgeEngine } from '../../packages/lily-ai/src/knowledge/knowledge-engine.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/knowledge/lily-knowledge-service.js';
import { LilyLanguageService } from '../../packages/lily-ai/src/services/language/lily-language-service.js';

test('F15 — Synonym Intelligence Engine', async (t) => {
  await t.test('1. Synonym loading & core dataset completeness', () => {
    const registry = SynonymLoader.load();
    assert.ok(registry.count() >= 20, `Expected at least 20 entries, got ${registry.count()}`);
    assert.strictEqual(registry.has('fast'), true);
    assert.strictEqual(registry.has('quick'), true);
    assert.strictEqual(registry.has('trainer'), true);
  });

  await t.test('2. Registry creation & storage operations', () => {
    const registry = new SynonymRegistry();
    registry.register({
      word: 'diligent',
      synonyms: ['hardworking', 'industrious'],
      confidence: 1.0,
      partOfSpeech: 'adjective'
    });

    assert.strictEqual(registry.has('diligent'), true);
    assert.strictEqual(registry.has('DILIGENT'), true);
    const entry = registry.get('diligent');
    assert.ok(entry);
    assert.strictEqual(entry.word, 'diligent');
    assert.ok(entry.synonyms.includes('hardworking'));
  });

  await t.test('3. Bidirectional resolution (fast <-> quick, quick <-> fast)', () => {
    const engine = new LilySynonymEngine();

    // Word: 'quick' -> should include 'fast', 'rapid', 'swift'
    const quickRes = engine.lookup('quick');
    assert.strictEqual(quickRes.found, true);
    assert.ok(quickRes.synonyms.includes('fast'));

    // Word: 'rapid' -> should include 'fast', 'quick', 'swift'
    const rapidRes = engine.lookup('rapid');
    assert.strictEqual(rapidRes.found, true);
    assert.ok(rapidRes.synonyms.includes('fast'));
    assert.ok(rapidRes.synonyms.includes('quick'));

    // Custom bidirectional test
    const customRegistry = new SynonymRegistry();
    customRegistry.register({
      word: 'alpha',
      synonyms: ['beta'],
      confidence: 0.95
    });

    assert.strictEqual(customRegistry.has('beta'), true);
    const betaSynonyms = customRegistry.getSynonyms('beta');
    assert.ok(betaSynonyms.includes('alpha'));
  });

  await t.test('4. Search expansion (query phrases and token expansions)', () => {
    const engine = new LilySynonymEngine();

    // Single term expansion
    const expandQuick = engine.expand('quick');
    assert.ok(expandQuick.expandedTerms.includes('quick'));
    assert.ok(expandQuick.expandedTerms.includes('fast'));
    assert.ok(expandQuick.expandedTerms.includes('rapid'));
    assert.ok(expandQuick.expandedTerms.includes('swift'));

    // Multi-term phrase expansion: "quick runner"
    const expandPhrase = engine.expand('quick runner');
    assert.ok(expandPhrase.tokens.includes('quick'));
    assert.ok(expandPhrase.tokens.includes('runner'));
    assert.ok(expandPhrase.expandedTerms.includes('fast'));
    assert.ok(expandPhrase.expandedTerms.includes('racer') || expandPhrase.expandedTerms.includes('sprinter'));

    // Verify expanded phrase variants
    assert.ok(expandPhrase.expandedPhrases.length >= 3);
    assert.ok(
      expandPhrase.expandedPhrases.some(p => p.includes('fast') && p.includes('runner')) ||
      expandPhrase.expandedPhrases.some(p => p.includes('quick') && p.includes('racer'))
    );

    // Sentence expansion: "trainer is quick"
    const expandSentence = engine.expand('trainer is quick');
    assert.ok(expandSentence.expandedTerms.includes('quick'));
    assert.ok(expandSentence.expandedTerms.includes('fast'));
    assert.ok(expandSentence.expandedTerms.includes('coach') || expandSentence.expandedTerms.includes('mentor'));
  });

  await t.test('5. Context-aware synonyms (race: competition vs population)', () => {
    const engine = new LilySynonymEngine();

    // Context: competition
    const competitionRace = engine.lookup('race', { context: 'competition' });
    assert.strictEqual(competitionRace.found, true);
    assert.ok(
      competitionRace.synonyms.includes('competition') ||
      competitionRace.synonyms.includes('derby') ||
      competitionRace.synonyms.includes('contest')
    );

    // Context: population
    const populationRace = engine.lookup('race', { context: 'population' });
    assert.strictEqual(populationRace.found, true);
    assert.ok(
      populationRace.synonyms.includes('lineage') ||
      populationRace.synonyms.includes('heritage') ||
      populationRace.synonyms.includes('ancestry')
    );
  });

  await t.test('6. Confidence scoring and classifications', () => {
    assert.strictEqual(SynonymConfidenceEngine.classify(1.00), 'direct');
    assert.strictEqual(SynonymConfidenceEngine.classify(0.90), 'direct');
    assert.strictEqual(SynonymConfidenceEngine.classify(0.75), 'close');
    assert.strictEqual(SynonymConfidenceEngine.classify(0.60), 'related');
    assert.strictEqual(SynonymConfidenceEngine.classify(0.30), 'distant');

    assert.strictEqual(SynonymConfidenceEngine.isSufficient(0.90, 0.50), true);
    assert.strictEqual(SynonymConfidenceEngine.isSufficient(0.40, 0.50), false);

    // Context adjustment
    const matchedConf = SynonymConfidenceEngine.calculateConfidence(0.80, 'competition', 'competition');
    assert.ok(matchedConf >= 0.85);

    const mismatchedConf = SynonymConfidenceEngine.calculateConfidence(0.80, 'competition', 'population');
    assert.ok(mismatchedConf <= 0.50);
  });

  await t.test('7. Cache behavior and LRU eviction', () => {
    const cache = new SynonymCache(100, 1000 * 60);
    cache.prewarm(DEFAULT_CORE_SYNONYMS);

    assert.ok(cache.size() >= 10);
    assert.strictEqual(cache.has('synonyms:fast'), true);
    assert.strictEqual(cache.has('synonyms:quick'), true);

    const fastSyns = cache.get<string[]>('synonyms:fast');
    assert.ok(fastSyns && fastSyns.includes('quick'));

    // LRU eviction test
    const smallCache = new SynonymCache(2, 1000 * 60);
    smallCache.set('x', 1);
    smallCache.set('y', 2);
    smallCache.set('z', 3); // should evict 'x'
    assert.strictEqual(smallCache.has('x'), false);
    assert.strictEqual(smallCache.has('y'), true);
    assert.strictEqual(smallCache.has('z'), true);
  });

  await t.test('8. Missing words / non-existent word queries', () => {
    const engine = new LilySynonymEngine();

    const missingRes = engine.lookup('nonexistentxyz123');
    assert.strictEqual(missingRes.found, false);
    assert.strictEqual(missingRes.synonyms.length, 0);

    const missingList = engine.findSynonyms('nonexistentxyz123');
    assert.strictEqual(missingList.length, 0);
    assert.strictEqual(engine.exists('nonexistentxyz123'), false);
  });

  await t.test('9. LanguageCore Integration (LilyLanguageService analyze pipeline)', () => {
    const langService = new LilyLanguageService();
    const analysis = langService.analyze('quick horse');

    assert.strictEqual(analysis.normalizedMessage, 'quick horse');
    assert.ok(analysis.expandedTerms && analysis.expandedTerms.length > 0);
    assert.ok(analysis.expandedTerms.includes('quick'));
    assert.ok(analysis.expandedTerms.includes('fast'));

    assert.ok(analysis.synonyms && analysis.synonyms['quick']);
    assert.ok(analysis.synonyms['quick'].includes('fast'));
  });

  await t.test('10. Knowledge integration & Hierarchy (Taxonomy 100 > Dictionary 75 > Glossary 65 > Synonym 60 > Vocabulary 50)', async () => {
    const engine = new KnowledgeEngine();

    // 1. Synonym query for "quick"
    const quickResults = await engine.query({ term: 'quick' });
    assert.ok(quickResults.length > 0);
    const synResult = quickResults.find(r => r.source === 'synonym');
    assert.ok(synResult);
    assert.strictEqual(synResult.authority, 60);
    assert.ok(synResult.content.synonyms.includes('fast'));

    // 2. Hierarchy comparison for Umamusume term "Front Runner"
    const frontRunnerResults = await engine.query({ term: 'Front Runner' });
    assert.ok(frontRunnerResults.length > 0);

    const taxonomyRes = frontRunnerResults.find(r => r.source === 'taxonomy');
    const dictRes = frontRunnerResults.find(r => r.source === 'dictionary');
    const synonymRes = frontRunnerResults.find(r => r.source === 'synonym');
    const vocabRes = frontRunnerResults.find(r => r.source === 'vocabulary');

    assert.ok(taxonomyRes);
    assert.strictEqual(taxonomyRes.authority, 100);

    if (dictRes) {
      assert.strictEqual(dictRes.authority, 75);
      assert.ok(taxonomyRes.authority > dictRes.authority);
    }

    if (synonymRes) {
      assert.strictEqual(synonymRes.authority, 60);
      if (dictRes) {
        assert.ok(dictRes.authority > synonymRes.authority);
      }
      assert.ok(taxonomyRes.authority > synonymRes.authority);
    }

    if (vocabRes) {
      assert.strictEqual(vocabRes.authority, 50);
      if (synonymRes) {
        assert.ok(synonymRes.authority > vocabRes.authority);
      }
    }

    // 3. LilyKnowledgeService resolve query
    const knowledgeService = new LilyKnowledgeService();
    const resolved = await knowledgeService.resolve({ term: 'quick' });
    assert.ok(resolved.length > 0);
    assert.ok(resolved.some(r => r.source === 'synonym'));
  });
});
