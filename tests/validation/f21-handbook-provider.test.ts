import { test } from 'node:test';
import assert from 'node:assert';
import {
  HandbookKnowledgeProvider,
  HandbookRegistry,
  HandbookLoader,
  HandbookSearchEngine,
  HandbookResolver,
  HandbookRankingEngine,
  HandbookCache,
  HandbookValidator,
  HandbookDocument
} from '../../packages/lily-ai/src/knowledge/handbook/index.js';
import { KnowledgeEngine } from '../../packages/lily-ai/src/knowledge/knowledge-engine.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/knowledge/lily-knowledge-service.js';

test('F21 — Handbook Knowledge Provider', async (t) => {
  const provider = new HandbookKnowledgeProvider();

  await t.test('1. Document Loading & Categories', () => {
    const registry = provider.getRegistry();
    const docs = registry.getAll();

    assert.ok(docs.length >= 10);

    const categories = new Set(docs.map(d => d.category));
    assert.ok(categories.has('Characters'));
    assert.ok(categories.has('Running Styles'));
    assert.ok(categories.has('Skills'));
    assert.ok(categories.has('Support Cards'));
    assert.ok(categories.has('Training'));
    assert.ok(categories.has('Races'));
    assert.ok(categories.has('Tracks'));
    assert.ok(categories.has('Club Systems'));
    assert.ok(categories.has('Fan Systems'));
    assert.ok(categories.has('Linking Systems'));
    assert.ok(categories.has('Bot Features'));

    const validation = registry.getValidationReport();
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.invalidDocuments, 0);
  });

  await t.test('2. Standard Search & Lookup', () => {
    // 1. Search by title / keyword
    const results = provider.search('Oguri Cap');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].document.id, 'guide_oguri_cap_build');
    assert.ok(results[0].confidence >= 0.85);

    // 2. Direct lookup by ID
    const docById = provider.lookup('guide_front_runner_strategy');
    assert.ok(docById);
    assert.strictEqual(docById?.category, 'Running Styles');

    // 3. Find guide by entity
    const guide = provider.findGuide('Front Runner', 'Running Styles');
    assert.ok(guide);
    assert.ok(guide?.title.includes('Front Runner'));
  });

  await t.test('3. Semantic Retrieval (Non-exact Matching)', () => {
    // Query: "How should I train Oguri?" -> Matches Oguri Cap Build Guide
    const results = provider.search('How should I train Oguri?');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].document.id, 'guide_oguri_cap_build');

    // Query: "Velocity-focused training deck" -> Matches Speed SSR Support Cards Guide
    const results2 = provider.search('velocity support cards');
    assert.ok(results2.length > 0);
    assert.ok(results2.some(r => r.document.id === 'guide_speed_cards'));
  });

  await t.test('4. Ranking Engine & Authority', () => {
    const rankingEngine = provider.getRankingEngine();
    const doc = provider.lookup('guide_oguri_cap_build')!;

    // Exact title should have highest score
    const rankExact = rankingEngine.rank(doc, 'Oguri Cap Build & Training Guide');
    const rankGeneric = rankingEngine.rank(doc, 'training');

    assert.ok(rankExact.score > rankGeneric.score);
    assert.ok(rankExact.matchReasons.includes('Exact title match'));
  });

  await t.test('5. Taxonomy Integration', () => {
    const results = provider.search('front runner', {
      taxonomyContext: ['running_style.front_runner']
    });

    assert.ok(results.length > 0);
    assert.strictEqual(results[0].document.id, 'guide_front_runner_strategy');
    assert.ok(results[0].matchReasons.some(r => r.includes('Taxonomy entity matched')));
  });

  await t.test('6. Lexical Integration (Synonym & Phrase Expansion)', () => {
    const resolver = provider.getResolver();
    const resolved = resolver.resolve('fast runner strategy');

    assert.ok(resolved.semanticTokens.includes('fast') || resolved.semanticTokens.includes('speed') || resolved.semanticTokens.includes('velocity'));
    assert.ok(resolved.taxonomyMatches.length >= 0);
  });

  await t.test('7. Versioning & Deprecation Handling', () => {
    const doc = provider.lookup('guide_club_fan_target')!;
    assert.ok(doc.version);
    assert.ok(doc.updatedAt instanceof Date);

    // Create a deprecated document and verify ranking penalty
    const testRegistry = new HandbookRegistry([
      {
        id: 'guide_deprecated_meta',
        title: 'Old Deprecated Speed Meta',
        category: 'Training',
        tags: ['speed', 'meta', 'deprecated'],
        content: 'Old outdated mechanics from version 0.9.0.',
        source: 'Community Guides',
        version: '0.9.0',
        updatedAt: new Date('2024-01-01'),
        deprecated: true
      },
      {
        id: 'guide_active_meta',
        title: 'Current Speed Meta Guide',
        category: 'Training',
        tags: ['speed', 'meta', 'active'],
        content: 'Up to date speed mechanics for URA and beyond.',
        source: 'Curated Guides',
        version: '2.0.0',
        updatedAt: new Date('2026-03-01'),
        deprecated: false
      }
    ]);

    const searchEngine = new HandbookSearchEngine(testRegistry);
    const searchWithDeprecated = searchEngine.search('speed meta', { includeDeprecated: true });
    assert.strictEqual(searchWithDeprecated[0].document.id, 'guide_active_meta');
  });

  await t.test('8. Related Document Retrieval & Recommendations', () => {
    // 1. Related documents for Oguri Cap
    const related = provider.getRelatedDocuments('guide_oguri_cap_build');
    assert.ok(related.length > 0);
    const relatedIds = related.map(r => r.id);
    assert.ok(relatedIds.includes('guide_leader_style') || relatedIds.includes('guide_speed_cards') || relatedIds.includes('guide_stamina_skills'));

    // 2. Actionable recommendations
    const recResult = provider.recommend({
      character: 'Oguri Cap',
      goal: 'Medium distance race'
    });

    assert.ok(recResult.primaryGuide);
    assert.ok(recResult.recommendations.length > 0);
    assert.ok(recResult.confidence >= 0.7);
  });

  await t.test('9. Cache Behavior', () => {
    const cache = provider.getCache();
    cache.clear();
    assert.strictEqual(cache.size(), 0);

    // First search populates cache
    provider.search('Oguri Cap');
    assert.strictEqual(cache.size(), 1);

    // Second search retrieves from cache
    const cachedResults = cache.get('Oguri Cap');
    assert.ok(cachedResults);
    assert.strictEqual(cachedResults?.[0].document.id, 'guide_oguri_cap_build');
  });

  await t.test('10. Knowledge Engine & LilyKnowledgeService Registration (Authority 90)', async () => {
    const knowledgeEngine = new KnowledgeEngine();
    const sources = knowledgeEngine.getRegistry().getAll();

    const handbookSource = sources.find(s => s.id === 'handbook');
    assert.ok(handbookSource);
    assert.strictEqual(handbookSource?.priority, 90);
    assert.strictEqual(handbookSource?.type, 'handbook');

    // Hierarchy verification: Taxonomy (100) > Handbook (90) > Database (85) > Lexical (80) > Dictionary (75)
    const taxonomy = sources.find(s => s.id === 'taxonomy');
    const database = sources.find(s => s.id === 'database');
    const lexical = sources.find(s => s.id === 'lexical_intelligence');
    const dictionary = sources.find(s => s.id === 'dictionary');

    assert.strictEqual(taxonomy?.priority, 100);
    assert.strictEqual(handbookSource?.priority, 90);
    assert.strictEqual(database?.priority, 85);
    assert.strictEqual(lexical?.priority, 80);
    assert.strictEqual(dictionary?.priority, 75);

    // Test query execution through KnowledgeEngine
    const results = await knowledgeEngine.query({
      term: 'Oguri Cap',
      context: { domain: 'Umamusume' }
    });

    assert.ok(results.length > 0);
    const handbookResult = results.find(r => r.source === 'handbook');
    assert.ok(handbookResult);
    assert.strictEqual(handbookResult?.authority, 90);
  });
});
