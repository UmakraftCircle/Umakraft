import { test } from 'node:test';
import assert from 'node:assert';
import {
  GlossaryService,
  LanguageCoreService
} from '../../packages/lily-ai/src/language-core/index.js';

test('F4 — Glossary Intelligence System', async (t) => {
  const glossaryService = new GlossaryService();
  const coreService = new LanguageCoreService();

  await t.test('F4.1 Glossary lookup & Structured definitions', () => {
    // Standard registration lookup
    const linkEntry = glossaryService.lookup('link');
    assert.ok(linkEntry);
    assert.strictEqual(linkEntry.term, 'link');
    assert.strictEqual(linkEntry.domain, 'Umakraft');
    assert.ok(linkEntry.description.includes('Discord ID'));
  });

  await t.test('F4.2 Alias resolution & Terminology Engine', () => {
    const terminologyEngine = glossaryService.getTerminologyEngine();

    // Check alias resolution
    const resolvedTerm = terminologyEngine.resolveTerm('nige');
    assert.strictEqual(resolvedTerm, 'Front Runner');

    const resolvedSenkou = terminologyEngine.resolveTerm('senkou');
    assert.strictEqual(resolvedSenkou, 'Pace Chaser');

    // Entry retrieval
    const nigeEntry = terminologyEngine.getEntry('nige');
    assert.ok(nigeEntry);
    assert.strictEqual(nigeEntry.term, 'Front Runner');
    assert.strictEqual(nigeEntry.domain, 'Umamusume');
  });

  await t.test('F4.3 Domain detection', () => {
    // Detect Umamusume
    const domainsUma = glossaryService.detectDomains('Need Front Runner parent.');
    assert.ok(domainsUma.includes('Umamusume'));

    // Detect Umakraft
    const domainsKraft = glossaryService.detectDomains('Link request pending.');
    assert.ok(domainsKraft.includes('Umakraft'));

    // Multi-domain detection
    const domainsMulti = glossaryService.detectDomains('Tell me the status of the Discord bot link request.');
    assert.ok(domainsMulti.includes('Discord'));
    assert.ok(domainsMulti.includes('Umakraft'));
  });

  await t.test('F4.4 Taxonomy import (Z-reduction / Truth persistence)', () => {
    // Characters should be imported from Taxonomy Service dynamically
    const oguri = glossaryService.lookup('Oguri Cap');
    assert.ok(oguri);
    assert.strictEqual(oguri.source, 'taxonomy');
    assert.strictEqual(oguri.type, 'character');

    // Skills from Taxonomy
    const cornerAdept = glossaryService.lookup('Corner Adept ○');
    assert.ok(cornerAdept);
    assert.strictEqual(cornerAdept.source, 'taxonomy');
    assert.strictEqual(cornerAdept.type, 'skill');
  });

  await t.test('F4.5 Glossary search queries', () => {
    const search = glossaryService.search();

    // Search by Term
    const termMatches = search.searchTerm('Front');
    assert.ok(termMatches.some(e => e.term === 'Front Runner'));

    // Search by Alias
    const aliasMatches = search.searchAlias('nige');
    assert.ok(aliasMatches.some(e => e.term === 'Front Runner'));

    // Search by Domain
    const domainMatches = search.searchDomain('Umakraft');
    assert.ok(domainMatches.some(e => e.term === 'link'));

    // Search by Description keywords
    const descMatches = search.searchDescription('Discord');
    assert.ok(descMatches.length > 0);
  });

  await t.test('F4.6 Usage tracking & analytics', () => {
    const memory = glossaryService.getMemory();
    memory.clear();

    // Check pre-condition
    assert.strictEqual(memory.getAllUsages().length, 0);

    // Lookups track usage
    glossaryService.lookup('link');
    glossaryService.lookup('link');

    const linkUsage = memory.getUsage('link');
    assert.ok(linkUsage);
    assert.strictEqual(linkUsage.count, 2);
    assert.strictEqual(linkUsage.term, 'link');
  });

  await t.test('F4.7 Multi-domain support & custom registration', () => {
    // Custom AI domain registration
    glossaryService.register({
      term: 'Antigravity',
      domain: 'AI',
      description: 'Internal prompt agent core framework powering Lily.',
      aliases: ['antigravity core', 'antigrav'],
      source: 'manual'
    });

    const antiGrav = glossaryService.lookup('antigravity');
    assert.ok(antiGrav);
    assert.strictEqual(antiGrav.domain, 'AI');
  });

  await t.test('F4.8 LanguageCore Integration Pipeline', async () => {
    // Test end-to-end integration
    const result = await coreService.analyze('Need a nige parent link approval.');
    
    // Check matched entities/glossaryTerms
    assert.ok(result.glossaryTerms);
    assert.ok(result.glossaryTerms.some(e => e.term === 'Front Runner'));
    assert.ok(result.glossaryTerms.some(e => e.term === 'link'));
    assert.ok(result.glossaryTerms.some(e => e.term === 'approval'));

    // Check detected domains
    assert.ok(result.detectedDomains);
    assert.ok(result.detectedDomains.includes('Umamusume'));
    assert.ok(result.detectedDomains.includes('Umakraft'));
  });
});
