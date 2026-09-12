import { test } from 'node:test';
import assert from 'node:assert';
import {
  LilyKnowledgeService,
  KnowledgeEngine,
  KnowledgeRegistry,
  KnowledgeResolver,
  KnowledgeRanking,
  KnowledgeCache,
  TaxonomyKnowledgeSource,
  DatabaseKnowledgeSource,
  HandbookKnowledgeSource,
  GlossaryKnowledgeSource,
  KnowledgeResult
} from '../../packages/lily-ai/src/knowledge/index.js';
import { LanguageCoreService } from '../../packages/lily-ai/src/language-core/index.js';

test('F11 — Knowledge Foundation Service', async (t) => {
  const service = new LilyKnowledgeService();

  await t.test('1. Registry registration', () => {
    const registry = new KnowledgeRegistry();
    const source: any = {
      id: 'custom_source',
      name: 'Custom Source',
      type: 'static_documents',
      priority: 50,
      query: async () => []
    };

    registry.register(source);
    assert.strictEqual(registry.get('custom_source'), source);
    assert.strictEqual(registry.getAll().length, 1);
    assert.strictEqual(registry.getByType('static_documents').length, 1);

    registry.unregister('custom_source');
    assert.strictEqual(registry.get('custom_source'), undefined);
  });

  await t.test('2. Source loading', () => {
    const engine = service.getEngine();
    const registry = engine.getRegistry();

    const sources = registry.getAll();
    assert.ok(sources.length >= 4, 'Should load at least 4 default sources');

    const taxonomy = registry.get('taxonomy');
    const database = registry.get('database');
    const handbook = registry.get('handbook');
    const glossary = registry.get('glossary');

    assert.ok(taxonomy, 'Taxonomy source must be registered');
    assert.ok(database, 'Database source must be registered');
    assert.ok(handbook, 'Handbook source must be registered');
    assert.ok(glossary, 'Glossary source must be registered');

    assert.strictEqual(taxonomy?.priority, 100);
    assert.strictEqual(database?.priority, 85);
    assert.strictEqual(handbook?.priority, 75);
    assert.strictEqual(glossary?.priority, 65);
  });

  await t.test('3. Resolver queries', async () => {
    const results = await service.resolve('Front Runner');
    assert.ok(results.length > 0, 'Should find results for Front Runner');

    const first = results[0];
    assert.strictEqual(first.source, 'taxonomy');
    assert.strictEqual((first.content as any).canonical, 'Front Runner');
  });

  await t.test('4. Ranking logic', () => {
    const ranking = new KnowledgeRanking();

    const dummyResults: KnowledgeResult[] = [
      { source: 'user_content', authority: 20, content: 'User tip on nige', confidence: 0.9 },
      { source: 'glossary', authority: 65, content: 'Nige', confidence: 0.95 },
      { source: 'taxonomy', authority: 100, content: 'Front Runner', confidence: 0.99 },
      { source: 'database', authority: 85, content: 'Front Runner aptitude', confidence: 0.95 }
    ];

    const ranked = ranking.rank(dummyResults);

    assert.strictEqual(ranked[0].source, 'taxonomy', 'Official Taxonomy wins');
    assert.strictEqual(ranked[1].source, 'database', 'Official Database is second');
    assert.strictEqual(ranked[2].source, 'glossary', 'Glossary is third');
    assert.strictEqual(ranked[3].source, 'user_content', 'User Content is last');
  });

  await t.test('5. Taxonomy priority (Official terminology wins)', async () => {
    // Both taxonomy and glossary might know "Nige" / "Front Runner"
    const results = await service.resolve('nige');
    assert.ok(results.length > 0);

    // Taxonomy has authority 100, glossary has authority 65
    assert.strictEqual(results[0].source, 'taxonomy');
    assert.strictEqual((results[0].content as any).canonical, 'Front Runner');
    assert.strictEqual(results[0].authority, 100);
  });

  await t.test('6. Context-aware retrieval', async () => {
    // When querying "Front Runner" under context of parent search (running style category)
    const results = await service.resolve({
      term: 'Front Runner',
      context: {
        intent: 'parent_search',
        category: 'running_style',
        domain: 'Umamusume'
      }
    });

    assert.ok(results.length > 0);
    const top = results[0];
    assert.strictEqual(top.source, 'taxonomy');
    assert.strictEqual((top.content as any).type, 'running_style');
  });

  await t.test('7. Cache behavior', async () => {
    const engine = service.getEngine();
    const cache = engine.getCache();
    cache.clear();

    assert.strictEqual(cache.has('Concentration'), false);

    // First call populates cache
    const res1 = await service.resolve('Concentration');
    assert.ok(res1.length > 0);
    assert.strictEqual(cache.has('Concentration'), true);

    // Second call reads from cache
    const res2 = await service.resolve('Concentration');
    assert.deepStrictEqual(res1, res2);
  });

  await t.test('8. Result confidence & structure', async () => {
    const results = await service.resolve('Oguri Cap');
    assert.ok(results.length > 0);

    const result = results[0];
    assert.ok('source' in result);
    assert.ok('authority' in result);
    assert.ok('content' in result);
    assert.ok('confidence' in result);

    assert.strictEqual(typeof result.source, 'string');
    assert.strictEqual(typeof result.authority, 'number');
    assert.strictEqual(typeof result.confidence, 'number');
    assert.ok(result.confidence >= 0 && result.confidence <= 1.0);
  });

  await t.test('9. Multi-source retrieval', async () => {
    // "150m" matches handbook (150 million fan requirement)
    const handbookResults = await service.resolve('150m');
    assert.ok(handbookResults.some(r => r.source === 'handbook'));

    // "Oguri Cap" matches taxonomy and database
    const oguriResults = await service.resolve('Oguri Cap');
    const sources = oguriResults.map(r => r.source);
    assert.ok(sources.includes('taxonomy'));
    assert.ok(sources.includes('database'));
  });

  await t.test('10. Service integration (LanguageCore -> LilyKnowledgeService)', async () => {
    const core = new LanguageCoreService();
    const coreResult = await core.analyze('What is the minimum fan requirement in the handbook?');

    // Query Knowledge Service using LanguageCore analysis result
    const knowledgeResults = await service.resolveFromLanguageCore({
      normalizedText: coreResult.normalizedText,
      entities: coreResult.entities,
      understanding: {
        goal: coreResult.understanding?.goal,
        possibleIntent: coreResult.understanding?.possibleIntent
      },
      detectedDomains: coreResult.detectedDomains
    });

    assert.ok(knowledgeResults.length > 0);
    // Handbook entry for 150m monthly fans should match
    const handbookMatch = knowledgeResults.find(r => r.source === 'handbook');
    assert.ok(handbookMatch, 'Handbook match must be retrieved');
  });
});
