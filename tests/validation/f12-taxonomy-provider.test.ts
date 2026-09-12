import { test } from 'node:test';
import assert from 'node:assert';
import {
  TaxonomyKnowledgeProvider,
  TaxonomyLoader,
  TaxonomyRegistry,
  TaxonomyIndex,
  TaxonomyAliasResolver,
  TaxonomySearch,
  TaxonomyResolver,
  TaxonomyValidator,
  TaxonomyCache,
  TaxonomyNode,
  DEFAULT_TAXONOMY_NODES
} from '../../packages/lily-ai/src/knowledge/providers/taxonomy/index.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/knowledge/index.js';

test('F12 — Taxonomy Knowledge Provider', async (t) => {
  const provider = new TaxonomyKnowledgeProvider();

  await t.test('1. Taxonomy loading', () => {
    // Test loading default nodes
    const registry = TaxonomyLoader.load();
    assert.ok(registry.count() > 0, 'Registry must have loaded nodes');
    assert.ok(registry.count() >= 30, 'Should load all default taxonomy nodes');

    // Test markdown loading
    const markdownSample = `
# Running Style
- Front Runner (aliases: Nige, Runner)
- Pace Chaser (aka: Senkou, Leader)

# Distance
- Sprint (aliases: Short)
- Mile
`;
    const mdRegistry = TaxonomyLoader.loadFromMarkdown(markdownSample);
    assert.strictEqual(mdRegistry.count(), 4);
    assert.ok(mdRegistry.get('running_style.front_runner'));
    assert.strictEqual(mdRegistry.get('running_style.front_runner')?.name, 'Front Runner');
    assert.deepStrictEqual(mdRegistry.get('running_style.front_runner')?.aliases, ['Nige', 'Runner']);
  });

  await t.test('2. Registry creation', () => {
    const registry = new TaxonomyRegistry();
    const node: TaxonomyNode = {
      id: 'running_style.front_runner',
      name: 'Front Runner',
      category: 'Running Style',
      aliases: ['Nige']
    };

    registry.register(node);
    assert.strictEqual(registry.count(), 1);
    assert.strictEqual(registry.get('running_style.front_runner'), node);
    assert.strictEqual(registry.getAll().length, 1);
    assert.strictEqual(registry.getByCategory('Running Style').length, 1);
    assert.strictEqual(registry.getByCategory('running_style').length, 1);

    registry.clear();
    assert.strictEqual(registry.count(), 0);
  });

  await t.test('3. Alias resolution', () => {
    // "nige" -> { "officialName": "Front Runner" }
    const resNige = provider.resolveAlias('nige');
    assert.ok(resNige, 'Should resolve nige');
    assert.strictEqual(resNige?.officialName, 'Front Runner');
    assert.strictEqual(resNige?.node?.id, 'running_style.front_runner');

    // "senkou" -> { "officialName": "Pace Chaser" }
    const resSenkou = provider.resolveAlias('senkou');
    assert.ok(resSenkou, 'Should resolve senkou');
    assert.strictEqual(resSenkou?.officialName, 'Pace Chaser');
    assert.strictEqual(resSenkou?.node?.id, 'running_style.pace_chaser');

    // "sashi" -> Late Surger
    const resSashi = provider.resolveAlias('sashi');
    assert.strictEqual(resSashi?.officialName, 'Late Surger');

    // "oikomi" -> End Closer
    const resOikomi = provider.resolveAlias('oikomi');
    assert.strictEqual(resOikomi?.officialName, 'End Closer');
  });

  await t.test('4. Official name enforcement', () => {
    // Official name always wins
    const officialRes = provider.resolveAlias('Front Runner');
    assert.ok(officialRes);
    assert.strictEqual(officialRes?.officialName, 'Front Runner');

    const teioRes = provider.resolveAlias('Tokai Teio');
    assert.ok(teioRes);
    assert.strictEqual(teioRes?.officialName, 'Tokai Teio');

    const node = provider.findByName('Front Runner');
    assert.ok(node);
    assert.strictEqual(node?.name, 'Front Runner');
    assert.strictEqual(node?.id, 'running_style.front_runner');
  });

  await t.test('5. Category queries', () => {
    const runningStyles = provider.findByCategory('Running Style');
    assert.strictEqual(runningStyles.length, 4);
    const styleNames = runningStyles.map(s => s.name);
    assert.ok(styleNames.includes('Front Runner'));
    assert.ok(styleNames.includes('Pace Chaser'));
    assert.ok(styleNames.includes('Late Surger'));
    assert.ok(styleNames.includes('End Closer'));

    const tracks = provider.findByCategory('Track');
    assert.ok(tracks.length >= 9);

    const conditions = provider.findByCategory('Condition');
    assert.ok(conditions.length >= 5);

    const items = provider.findByCategory('Item');
    assert.ok(items.length >= 4);
  });

  await t.test('6. Search behavior', () => {
    // Direct ID search
    const byId = provider.findById('running_style.front_runner');
    assert.ok(byId);
    assert.strictEqual(byId?.name, 'Front Runner');

    // Alias search
    const byAlias = provider.findByAlias('nige');
    assert.ok(byAlias);
    assert.strictEqual(byAlias?.name, 'Front Runner');

    // Ranked multi-match search
    const results = provider.search('Arima');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].node.name, 'Arima Kinen');
    assert.strictEqual(results[0].node.category, 'Race');

    // Search with category filter
    const skillResults = provider.search('Concentration', { category: 'Skill' });
    assert.ok(skillResults.length > 0);
    assert.strictEqual(skillResults[0].node.name, 'Concentration');
    assert.strictEqual(skillResults[0].node.category, 'Skill');
  });

  await t.test('7. Ambiguous matches (Resolving ambiguity)', () => {
    // Unambiguous input
    // Input: Front Runner -> { id: "running_style.front_runner", category: "Running Style", officialName: "Front Runner" }
    const unambiguous = provider.resolve('Front Runner');
    assert.strictEqual(unambiguous.ambiguous, false);
    assert.strictEqual(unambiguous.id, 'running_style.front_runner');
    assert.strictEqual(unambiguous.category, 'Running Style');
    assert.strictEqual(unambiguous.officialName, 'Front Runner');

    // Ambiguous input
    // Input: rudolf -> { ambiguous: true, matches: ["Symboli Rudolf", "Rudolf Event"] }
    const ambiguous = provider.resolve('rudolf');
    assert.strictEqual(ambiguous.ambiguous, true);
    assert.ok(Array.isArray(ambiguous.matches));
    assert.ok(ambiguous.matches.includes('Symboli Rudolf'));
    assert.ok(ambiguous.matches.includes('Rudolf Event'));

    // Disambiguation via category context
    const characterRudolf = provider.resolve('rudolf', { category: 'Character' });
    assert.strictEqual(characterRudolf.ambiguous, false);
    assert.strictEqual(characterRudolf.officialName, 'Symboli Rudolf');

    const eventRudolf = provider.resolve('rudolf', { category: 'Event' });
    assert.strictEqual(eventRudolf.ambiguous, false);
    assert.strictEqual(eventRudolf.officialName, 'Rudolf Event');
  });

  await t.test('8. Validation checks', () => {
    const report = provider.getValidationReport();
    assert.strictEqual(report.valid, true, 'Default taxonomy must pass validation with 0 errors');
    assert.strictEqual(report.errors.length, 0);

    // Test failing validation on broken registry
    const brokenRegistry = new TaxonomyRegistry();
    brokenRegistry.register({
      id: 'dup_id',
      name: 'Duplicate One',
      category: 'Character',
      aliases: ['dup']
    });
    brokenRegistry.register({
      id: 'dup_id', // duplicate ID error
      name: 'Duplicate Two',
      category: 'Character',
      aliases: ['dup2']
    });
    brokenRegistry.register({
      id: 'missing_cat',
      name: 'No Category',
      category: '', // missing category error
      aliases: []
    });
    brokenRegistry.register({
      id: 'missing_name',
      name: '', // missing name error
      category: 'Character',
      aliases: []
    });

    const brokenReport = TaxonomyValidator.validate(brokenRegistry);
    assert.strictEqual(brokenReport.valid, false);
    assert.ok(brokenReport.errors.length >= 3);
  });

  await t.test('9. Cache behavior', () => {
    const cache = provider.getCache();

    // Cache prewarming checked
    assert.ok(cache.size() > 0, 'Cache should be prewarmed on startup');
    assert.ok(cache.has('id:running_style.front_runner'));
    assert.ok(cache.has('name:Front Runner'));
    assert.ok(cache.has('name:Symboli Rudolf'));

    // Cache lookup speed and hits
    const nodeFromCache = cache.get<TaxonomyNode>('name:Front Runner');
    assert.strictEqual(nodeFromCache?.id, 'running_style.front_runner');

    // Cache custom set/get/ttl
    cache.set('custom_key', { test: true }, 5000);
    assert.strictEqual(cache.has('custom_key'), true);
    assert.deepStrictEqual(cache.get('custom_key'), { test: true });
    cache.delete('custom_key');
    assert.strictEqual(cache.has('custom_key'), false);
  });

  await t.test('10. Knowledge integration (LilyKnowledgeService)', async () => {
    const knowledgeService = new LilyKnowledgeService();

    // Query official taxonomy through LilyKnowledgeService
    const results = await knowledgeService.resolve('Front Runner');
    assert.ok(results.length > 0);
    const topResult = results[0];

    assert.strictEqual(topResult.source, 'taxonomy');
    assert.strictEqual(topResult.authority, 100);
    assert.strictEqual((topResult.content as any).name, 'Front Runner');
    assert.strictEqual(topResult.confidence, 1.0);

    // Query alias "nige" through LilyKnowledgeService
    const aliasResults = await knowledgeService.resolve('nige');
    assert.ok(aliasResults.length > 0);
    assert.strictEqual(aliasResults[0].source, 'taxonomy');
    assert.strictEqual(aliasResults[0].authority, 100);
    assert.strictEqual((aliasResults[0].content as any).name, 'Front Runner');
  });
});
