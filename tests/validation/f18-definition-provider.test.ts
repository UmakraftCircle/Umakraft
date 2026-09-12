import { test } from 'node:test';
import assert from 'node:assert';
import {
  DefinitionKnowledgeProvider,
  DefinitionRegistry,
  DefinitionLoader,
  DefinitionResolver,
  DefinitionSearch,
  DefinitionCache,
  DefinitionConfidenceEngine,
  DefinitionValidator,
  CORE_OFFLINE_DEFINITIONS,
  DEFINITION_SOURCES
} from '../../packages/lily-ai/src/vocabulary/index.js';
import { KnowledgeEngine } from '../../packages/lily-ai/src/knowledge/knowledge-engine.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/knowledge/lily-knowledge-service.js';
import { LilyLanguageService } from '../../packages/lily-ai/src/services/language/lily-language-service.js';

test('F18 — Definition Intelligence Provider', async (t) => {
  await t.test('1. Definition lookup (serendipity, epistemology, heuristics)', () => {
    const provider = new DefinitionKnowledgeProvider();

    // 1. Serendipity
    const serendipity = provider.lookupDefinition('serendipity');
    assert.strictEqual(serendipity.found, true);
    assert.ok(serendipity.bestDefinition?.toLowerCase().includes('valuable'));
    assert.strictEqual(serendipity.source, 'wiktionary');
    assert.ok(serendipity.confidence >= 0.95);

    // 2. Epistemology
    const epistemology = provider.lookupDefinition('epistemology');
    assert.strictEqual(epistemology.found, true);
    assert.ok(epistemology.bestDefinition?.toLowerCase().includes('knowledge'));
    assert.strictEqual(epistemology.source, 'wiktionary');

    // 3. Heuristics
    const heuristics = provider.lookupDefinition('heuristics');
    assert.strictEqual(heuristics.found, true);
    assert.ok(heuristics.bestDefinition?.toLowerCase().includes('rule of thumb') || heuristics.bestDefinition?.toLowerCase().includes('practical'));

    // 4. Non-existent word
    const nonExistent = provider.lookupDefinition('nonexistentwordxyz123');
    assert.strictEqual(nonExistent.found, false);
    assert.strictEqual(nonExistent.definitions.length, 0);
  });

  await t.test('2. Resolver logic and normalization', () => {
    const registry = new DefinitionRegistry();
    registry.register({
      word: 'catalyst',
      definition: 'A substance that increases the rate of a chemical reaction without itself undergoing any permanent chemical change.',
      source: 'wiktionary',
      authority: 85,
      confidence: 0.95
    });

    const resolver = new DefinitionResolver(registry);

    // Casing & whitespace invariance
    const res1 = resolver.resolve('  CATALYST  ');
    assert.strictEqual(res1.found, true);
    assert.strictEqual(res1.word, 'catalyst');

    // Stemming / plural fallback
    const resPlural = resolver.resolve('catalysts');
    assert.strictEqual(resPlural.found, true);
    assert.strictEqual(resPlural.word, 'catalyst');
  });

  await t.test('3. Multi-definition support (returns definitions: Definition[])', () => {
    const provider = new DefinitionKnowledgeProvider();

    const raceLookup = provider.lookupDefinition('race');
    assert.strictEqual(raceLookup.found, true);
    assert.ok(raceLookup.definitions.length >= 2, `Expected multiple definitions, got ${raceLookup.definitions.length}`);

    // Verify definitions are structured objects with required fields
    for (const def of raceLookup.definitions) {
      assert.ok(def.word);
      assert.ok(def.definition);
      assert.ok(def.source);
      assert.ok(typeof def.authority === 'number');
      assert.ok(typeof def.confidence === 'number');
    }
  });

  await t.test('4. Ranking behavior & context-aware disambiguation', () => {
    const provider = new DefinitionKnowledgeProvider();

    // 1. "race strategy" query -> should select competition definition
    const competitionResult = provider.lookupDefinition('race', {
      context: 'racing',
      query: 'race strategy'
    });
    assert.strictEqual(competitionResult.found, true);
    assert.ok(competitionResult.bestDefinition?.toLowerCase().includes('competition') || competitionResult.bestDefinition?.toLowerCase().includes('speed'));
    assert.strictEqual(competitionResult.selectedDefinition?.context, 'racing');

    // 2. Anthropology context -> should select demographics/ethnic definition
    const anthroResult = provider.lookupDefinition('race', {
      context: 'anthropology',
      query: 'demographics population lineage'
    });
    assert.strictEqual(anthroResult.found, true);
    assert.ok(anthroResult.bestDefinition?.toLowerCase().includes('categorization') || anthroResult.bestDefinition?.toLowerCase().includes('ancestry'));
    assert.strictEqual(anthroResult.selectedDefinition?.context, 'anthropology');

    // 3. Biology context -> should select biological subspecies definition
    const bioResult = provider.lookupDefinition('race', {
      context: 'biology',
      query: 'flora fauna subspecies breed'
    });
    assert.strictEqual(bioResult.found, true);
    assert.ok(bioResult.bestDefinition?.toLowerCase().includes('subspecies') || bioResult.bestDefinition?.toLowerCase().includes('population'));
  });

  await t.test('5. Context resolution for specialized terms (spark, fan, link)', () => {
    const provider = new DefinitionKnowledgeProvider();

    // SPARK: uma_musume inheritance factor vs physics electrical discharge
    const umaSpark = provider.lookupDefinition('spark', { context: 'uma_musume' });
    assert.ok(umaSpark.bestDefinition?.toLowerCase().includes('inheritance'));

    const physSpark = provider.lookupDefinition('spark', { context: 'physics' });
    assert.ok(physSpark.bestDefinition?.toLowerCase().includes('electrical') || physSpark.bestDefinition?.toLowerCase().includes('glowing'));

    // FAN: uma_musume supporter vs cooling appliance
    const umaFan = provider.lookupDefinition('fan', { context: 'uma_musume' });
    assert.ok(umaFan.bestDefinition?.toLowerCase().includes('supporter') || umaFan.bestDefinition?.toLowerCase().includes('follower'));

    const appFan = provider.lookupDefinition('fan', { context: 'appliance' });
    assert.ok(appFan.bestDefinition?.toLowerCase().includes('air') || appFan.bestDefinition?.toLowerCase().includes('blades'));

    // LINK: system account link vs computing url
    const sysLink = provider.lookupDefinition('link', { context: 'system' });
    assert.ok(sysLink.bestDefinition?.toLowerCase().includes('trainer') || sysLink.bestDefinition?.toLowerCase().includes('account'));

    const compLink = provider.lookupDefinition('link', { context: 'computing' });
    assert.ok(compLink.bestDefinition?.toLowerCase().includes('url') || compLink.bestDefinition?.toLowerCase().includes('hyperlink'));
  });

  await t.test('6. Source priority (Curated 100 > Wiktionary 85 > WordNet 75 > Learned 50)', () => {
    const registry = new DefinitionRegistry();

    registry.register({
      word: 'synergy',
      definition: 'WordNet: Combined action or operation.',
      source: 'wordnet',
      authority: 75,
      confidence: 0.90
    });

    registry.register({
      word: 'synergy',
      definition: 'Curated: The interaction of entities producing a combined effect greater than the sum.',
      source: 'curated_dictionary',
      authority: 100,
      confidence: 1.0
    });

    registry.register({
      word: 'synergy',
      definition: 'Wiktionary: The combined power of a group of things.',
      source: 'wiktionary',
      authority: 85,
      confidence: 0.95
    });

    const resolver = new DefinitionResolver(registry);
    const result = resolver.resolve('synergy');

    assert.strictEqual(result.found, true);
    assert.strictEqual(result.selectedDefinition?.source, 'curated_dictionary');
    assert.strictEqual(result.selectedDefinition?.authority, 100);
  });

  await t.test('7. Confidence scoring & classification', () => {
    assert.strictEqual(DefinitionConfidenceEngine.getBaseConfidence('curated_dictionary'), 1.0);
    assert.strictEqual(DefinitionConfidenceEngine.getBaseConfidence('wiktionary'), 0.95);
    assert.strictEqual(DefinitionConfidenceEngine.getBaseConfidence('wordnet'), 0.90);
    assert.strictEqual(DefinitionConfidenceEngine.getBaseConfidence('learned_candidate'), 0.70);

    assert.strictEqual(DefinitionConfidenceEngine.classify(1.0), 'verified');
    assert.strictEqual(DefinitionConfidenceEngine.classify(0.95), 'verified');
    assert.strictEqual(DefinitionConfidenceEngine.classify(0.88), 'high');
    assert.strictEqual(DefinitionConfidenceEngine.classify(0.75), 'moderate');
    assert.strictEqual(DefinitionConfidenceEngine.classify(0.50), 'low');

    assert.strictEqual(DefinitionConfidenceEngine.isSufficient(0.95, 0.70), true);
    assert.strictEqual(DefinitionConfidenceEngine.isSufficient(0.50, 0.70), false);
  });

  await t.test('8. Cache behavior, LRU eviction, and JSONL dump pipeline', () => {
    const cache = new DefinitionCache(500, 1000 * 60);
    cache.prewarm(CORE_OFFLINE_DEFINITIONS);

    assert.ok(cache.size() >= 10);
    assert.strictEqual(cache.has('def:serendipity:philosophy'), true);
    assert.strictEqual(cache.has('def:serendipity'), true);

    // LRU eviction test
    const smallCache = new DefinitionCache(2, 1000 * 60);
    smallCache.set('a', { def: '1' });
    smallCache.set('b', { def: '2' });
    smallCache.set('c', { def: '3' }); // evicts 'a'

    assert.strictEqual(smallCache.has('a'), false);
    assert.strictEqual(smallCache.has('b'), true);
    assert.strictEqual(smallCache.has('c'), true);

    // JSONL dump export and import test
    const jsonl = DefinitionLoader.exportToJSONL([
      {
        word: 'quixotic',
        definition: 'Exceedingly idealistic; unrealistic and impractical.',
        source: 'wiktionary',
        authority: 85,
        confidence: 0.95,
        context: 'literature'
      }
    ]);

    const loaded = DefinitionLoader.loadFromJSONL(jsonl);
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].word, 'quixotic');
    assert.strictEqual(loaded[0].context, 'literature');
  });

  await t.test('9. LanguageCore integration (LilyLanguageService)', () => {
    const langService = new LilyLanguageService();
    const analysis = langService.analyze('The race strategy required serendipity and high stamina.');

    assert.ok(analysis.definitions);
    assert.ok(analysis.definitions['serendipity']);
    assert.ok(analysis.definitions['serendipity'].toLowerCase().includes('valuable') || analysis.definitions['serendipity'].toLowerCase().includes('chance'));
    assert.ok(analysis.definitions['race']);
    assert.ok(analysis.definitions['stamina']);
  });

  await t.test('10. Knowledge integration & Hierarchy (Taxonomy 100 > Database 85 > Handbook 75 / Dictionary 75 > Definition 70 > Glossary 65 > Synonym 60 = Antonym 60 > Vocabulary 50)', async () => {
    const engine = new KnowledgeEngine();

    // Query for "serendipity"
    const results = await engine.query({ term: 'serendipity' });
    assert.ok(results.length > 0);
    const defResult = results.find(r => r.source === 'definition');
    assert.ok(defResult);
    assert.strictEqual(defResult.authority, 70);
    assert.ok(defResult.confidence >= 0.95);

    // Query for multi-source term to compare hierarchy authorities
    const queryResults = await engine.query({ term: 'Front Runner' });
    assert.ok(queryResults.length > 0);

    const taxRes = queryResults.find(r => r.source === 'taxonomy');
    const dictRes = queryResults.find(r => r.source === 'dictionary');
    const glossRes = queryResults.find(r => r.source === 'glossary');
    const synRes = queryResults.find(r => r.source === 'synonym');
    const antRes = queryResults.find(r => r.source === 'antonym');
    const vocabRes = queryResults.find(r => r.source === 'vocabulary');

    assert.ok(taxRes);
    assert.strictEqual(taxRes.authority, 100);

    if (dictRes) {
      assert.strictEqual(dictRes.authority, 75);
      assert.ok(taxRes.authority > dictRes.authority);
      assert.ok(dictRes.authority > 70); // Dictionary > Definition (70)
    }

    if (glossRes) {
      assert.strictEqual(glossRes.authority, 65);
      assert.ok(70 > glossRes.authority); // Definition (70) > Glossary (65)
    }

    if (synRes && antRes) {
      assert.strictEqual(synRes.authority, 60);
      assert.strictEqual(antRes.authority, 60);
      assert.ok(70 > synRes.authority); // Definition (70) > Synonym (60)
    }

    if (vocabRes) {
      assert.strictEqual(vocabRes.authority, 50);
      assert.ok(70 > vocabRes.authority); // Definition (70) > Vocabulary (50)
    }

    // LilyKnowledgeService integration
    const knowledgeService = new LilyKnowledgeService();
    const resolved = await knowledgeService.resolve({ term: 'epistemology' });
    assert.ok(resolved.length > 0);
    assert.ok(resolved.some(r => r.source === 'definition'));
  });
});
