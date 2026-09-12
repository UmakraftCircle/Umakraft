import { test } from 'node:test';
import assert from 'node:assert';
import {
  LilyAntonymEngine,
  AntonymKnowledgeProvider,
  AntonymRegistry,
  AntonymLoader,
  AntonymResolver,
  AntonymSearch,
  AntonymNormalizer,
  AntonymCache,
  AntonymConfidenceEngine,
  AntonymConfidenceLevel,
  DEFAULT_CORE_ANTONYMS
} from '../../packages/lily-ai/src/vocabulary/index.js';
import { KnowledgeEngine } from '../../packages/lily-ai/src/knowledge/knowledge-engine.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/knowledge/lily-knowledge-service.js';
import { ConsistencyEngine } from '../../packages/lily-ai/src/language-core/reasoning/consistency-engine.js';
import { LilyLanguageService } from '../../packages/lily-ai/src/services/language/lily-language-service.js';

test('F16 — Antonym Intelligence Engine', async (t) => {
  await t.test('1. Antonym loading & core dataset completeness', () => {
    const registry = AntonymLoader.load();
    assert.ok(registry.count() >= 30, `Expected at least 30 entries, got ${registry.count()}`);
    assert.strictEqual(registry.has('win'), true);
    assert.strictEqual(registry.has('high'), true);
    assert.strictEqual(registry.has('fast'), true);
    assert.strictEqual(registry.has('increase'), true);
    assert.strictEqual(registry.has('met'), true);
  });

  await t.test('2. Registry creation & storage operations', () => {
    const registry = new AntonymRegistry();
    registry.register({
      word: 'diligent',
      antonyms: ['lazy'],
      confidence: 1.0,
      partOfSpeech: 'adjective'
    });

    assert.strictEqual(registry.has('diligent'), true);
    assert.strictEqual(registry.has('DILIGENT'), true);
    const entry = registry.get('diligent');
    assert.ok(entry);
    assert.strictEqual(entry.word, 'diligent');
    assert.ok(entry.antonyms.includes('lazy'));
  });

  await t.test('3. Bidirectional relationships (win <-> lose, high <-> low)', () => {
    const engine = new LilyAntonymEngine();

    // Word: 'win' -> should include 'lose'
    const winRes = engine.lookup('win');
    assert.strictEqual(winRes.found, true);
    assert.ok(winRes.antonyms.includes('lose'));

    // Word: 'lose' -> should automatically include 'win'
    const loseRes = engine.lookup('lose');
    assert.strictEqual(loseRes.found, true);
    assert.ok(loseRes.antonyms.includes('win'));

    // Word: 'high' <-> 'low'
    const highRes = engine.lookup('high');
    assert.strictEqual(highRes.found, true);
    assert.ok(highRes.antonyms.includes('low'));

    const lowRes = engine.lookup('low');
    assert.strictEqual(lowRes.found, true);
    assert.ok(lowRes.antonyms.includes('high'));

    // Custom bidirectional registration
    const customRegistry = new AntonymRegistry();
    customRegistry.register({
      word: 'alpha',
      antonyms: ['omega'],
      confidence: 0.95
    });

    assert.strictEqual(customRegistry.has('omega'), true);
    const omegaAntonyms = customRegistry.getAntonyms('omega');
    assert.ok(omegaAntonyms.includes('alpha'));
  });

  await t.test('4. Context-aware resolution (light: weight vs illumination; hard: difficulty vs texture)', () => {
    const engine = new LilyAntonymEngine();

    // Context: weight (light -> heavy)
    const weightLight = engine.lookup('light', { context: 'weight' });
    assert.strictEqual(weightLight.found, true);
    assert.ok(weightLight.antonyms.includes('heavy'));

    // Context: illumination (light -> dark)
    const illumLight = engine.lookup('light', { context: 'illumination' });
    assert.strictEqual(illumLight.found, true);
    assert.ok(illumLight.antonyms.includes('dark'));

    // Context: difficulty (hard -> easy)
    const diffHard = engine.lookup('hard', { context: 'difficulty' });
    assert.strictEqual(diffHard.found, true);
    assert.ok(diffHard.antonyms.includes('easy'));

    // Context: texture (hard -> soft)
    const textHard = engine.lookup('hard', { context: 'texture' });
    assert.strictEqual(textHard.found, true);
    assert.ok(textHard.antonyms.includes('soft'));
  });

  await t.test('5. Confidence scoring and classifications', () => {
    assert.strictEqual(AntonymConfidenceEngine.classify(1.00), 'direct');
    assert.strictEqual(AntonymConfidenceEngine.classify(0.90), 'direct');
    assert.strictEqual(AntonymConfidenceEngine.classify(0.75), 'strong');
    assert.strictEqual(AntonymConfidenceEngine.classify(0.60), 'moderate');
    assert.strictEqual(AntonymConfidenceEngine.classify(0.30), 'weak');

    assert.strictEqual(AntonymConfidenceEngine.isSufficient(0.90, 0.50), true);
    assert.strictEqual(AntonymConfidenceEngine.isSufficient(0.40, 0.50), false);

    // Context adjustments
    const matchedConf = AntonymConfidenceEngine.calculateConfidence(0.80, 'speed', 'speed');
    assert.ok(matchedConf >= 0.85);

    const mismatchedConf = AntonymConfidenceEngine.calculateConfidence(0.80, 'speed', 'security');
    assert.ok(mismatchedConf <= 0.50);
  });

  await t.test('6. Contradiction detection (opposite statements)', () => {
    const engine = new LilyAntonymEngine();

    // 1. "Speed increased." vs "Speed decreased."
    const speedContra = engine.checkContradiction('Speed increased', 'Speed decreased');
    assert.strictEqual(speedContra.contradiction, true);
    assert.ok(speedContra.contradictoryPairs.length > 0);

    // 2. "Requirement Met" vs "Requirement Not Met"
    const reqContra = engine.checkContradiction('Requirement Met', 'Requirement Not Met');
    assert.strictEqual(reqContra.contradiction, true);

    // 3. "Fan Gain Increased" vs "Fan Gain Decreased"
    const fanContra = engine.checkContradiction('Fan Gain Increased', 'Fan Gain Decreased');
    assert.strictEqual(fanContra.contradiction, true);

    // 4. Non-contradictory statements
    const nonContra = engine.checkContradiction('Speed increased', 'Stamina high');
    assert.strictEqual(nonContra.contradiction, false);
  });

  await t.test('7. Reasoning integration (ConsistencyEngine with antonym detection)', () => {
    const consistencyEngine = new ConsistencyEngine();

    // Check statements array
    const result = consistencyEngine.check({
      statements: ['Speed increased', 'Speed decreased']
    });

    assert.strictEqual(result.consistent, false);
    assert.strictEqual(result.inconsistent, true);
    assert.strictEqual(result.contradiction, true);
    assert.ok(result.issues.length > 0);
    assert.strictEqual(result.issues[0].type, 'contradiction');

    // Check facts with opposing antonym values
    const factsResult = consistencyEngine.check({
      facts: [
        { field: 'fan_trend', value: 'increase' },
        { field: 'fan_trend', value: 'decrease' }
      ]
    });

    assert.strictEqual(factsResult.consistent, false);
    assert.strictEqual(factsResult.contradiction, true);
  });

  await t.test('8. Cache behavior and LRU eviction', () => {
    const cache = new AntonymCache(500, 1000 * 60);
    cache.prewarm(DEFAULT_CORE_ANTONYMS);

    assert.ok(cache.size() >= 10);
    assert.strictEqual(cache.has('antonyms:win'), true);
    assert.strictEqual(cache.has('antonyms:high'), true);

    const winAnts = cache.get<string[]>('antonyms:win');
    assert.ok(winAnts && winAnts.includes('lose'));

    // LRU eviction test
    const smallCache = new AntonymCache(2, 1000 * 60);
    smallCache.set('a', 1);
    smallCache.set('b', 2);
    smallCache.set('c', 3); // should evict 'a'
    assert.strictEqual(smallCache.has('a'), false);
    assert.strictEqual(smallCache.has('b'), true);
    assert.strictEqual(smallCache.has('c'), true);
  });

  await t.test('9. Search functionality & expansion (expandOpposites, tokenAntonyms, oppositePhrases)', () => {
    const engine = new LilyAntonymEngine();

    // Single term expansion
    const expandWin = engine.expandOpposites('win');
    assert.ok(expandWin.tokens.includes('win'));
    assert.ok(expandWin.oppositeTerms.includes('lose'));

    // Multi-term phrase expansion: "speed increased"
    const expandSpeed = engine.expandOpposites('speed increased');
    assert.ok(expandSpeed.tokens.includes('speed'));
    assert.ok(expandSpeed.tokens.includes('increased'));
    assert.ok(expandSpeed.oppositeTerms.includes('decreased') || expandSpeed.oppositeTerms.includes('reduced'));
    assert.ok(expandSpeed.oppositePhrases.some(p => p.includes('decreased') || p.includes('reduced')));

    // areOpposites helper
    assert.strictEqual(engine.areOpposites('win', 'lose'), true);
    assert.strictEqual(engine.areOpposites('high', 'low'), true);
    assert.strictEqual(engine.areOpposites('fast', 'slow'), true);
    assert.strictEqual(engine.areOpposites('win', 'fast'), false);
  });

  await t.test('10. Knowledge integration & Hierarchy (Taxonomy 100 > Dictionary 75 > Glossary 65 > Synonym 60 = Antonym 60 > Vocabulary 50)', async () => {
    const engine = new KnowledgeEngine();

    // 1. Antonym query for "win"
    const winResults = await engine.query({ term: 'win' });
    assert.ok(winResults.length > 0);
    const antResult = winResults.find(r => r.source === 'antonym');
    assert.ok(antResult);
    assert.strictEqual(antResult.authority, 60);
    assert.ok(antResult.content.antonyms.includes('lose'));

    // 2. Hierarchy comparison
    const queryResults = await engine.query({ term: 'Front Runner' });
    assert.ok(queryResults.length > 0);

    const taxonomyRes = queryResults.find(r => r.source === 'taxonomy');
    const dictRes = queryResults.find(r => r.source === 'dictionary');
    const synRes = queryResults.find(r => r.source === 'synonym');
    const antRes = queryResults.find(r => r.source === 'antonym');
    const vocabRes = queryResults.find(r => r.source === 'vocabulary');

    assert.ok(taxonomyRes);
    assert.strictEqual(taxonomyRes.authority, 100);

    if (dictRes) {
      assert.strictEqual(dictRes.authority, 75);
      assert.ok(taxonomyRes.authority > dictRes.authority);
    }

    if (synRes && antRes) {
      assert.strictEqual(synRes.authority, 60);
      assert.strictEqual(antRes.authority, 60);
      if (dictRes) {
        assert.ok(dictRes.authority > antRes.authority);
      }
    }

    if (vocabRes) {
      assert.strictEqual(vocabRes.authority, 50);
      if (antRes) {
        assert.ok(antRes.authority > vocabRes.authority);
      }
    }

    // 3. LilyKnowledgeService query
    const knowledgeService = new LilyKnowledgeService();
    const resolved = await knowledgeService.resolve({ term: 'high' });
    assert.ok(resolved.length > 0);
    assert.ok(resolved.some(r => r.source === 'antonym'));

    // 4. LanguageCore pipeline check
    const langService = new LilyLanguageService();
    const analysis = langService.analyze('win match');
    assert.ok(analysis.antonyms);
    assert.ok(analysis.antonyms['win']);
    assert.ok(analysis.antonyms['win'].includes('lose'));
    assert.ok(analysis.oppositeTerms && analysis.oppositeTerms.includes('lose'));
  });
});
