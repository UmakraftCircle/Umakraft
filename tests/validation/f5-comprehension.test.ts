import { test } from 'node:test';
import assert from 'node:assert';
import {
  GlossaryService,
  LanguageCoreService,
  ReadingComprehensionEngine
} from '../../packages/lily-ai/src/language-core/index.js';

test('F5 — Reading Comprehension Engine', async (t) => {
  const glossaryService = new GlossaryService();
  const comprehensionEngine = new ReadingComprehensionEngine(glossaryService);
  const coreService = new LanguageCoreService();

  await t.test('F5.1 Fact extraction', () => {
    const text = 'Oguri Cap Speed: 1200 Stamina: 800. Trainer has 120M fans.';
    const result = comprehensionEngine.comprehend(text);

    assert.ok(result.facts.length >= 3);
    const speedFact = result.facts.find(f => f.attribute === 'speed');
    assert.ok(speedFact);
    assert.strictEqual(speedFact.value, 1200);

    const fanFact = result.facts.find(f => f.attribute === 'Fans');
    assert.ok(fanFact);
    assert.strictEqual(fanFact.value, 120000000);
  });

  await t.test('F5.2 Entity extraction', () => {
    const text = 'Need nige parent link approval.';
    const result = comprehensionEngine.comprehend(text);

    // Should find Front Runner (resolved from nige), link, approval
    assert.ok(result.entities.some(e => e.name === 'Front Runner'));
    assert.ok(result.entities.some(e => e.name === 'link'));
    assert.ok(result.entities.some(e => e.name === 'approval'));
  });

  await t.test('F5.3 Relationship detection', () => {
    // Deficit fans relationship
    const textDeficit = 'Current Fans: 120M. Required Fans: 150M.';
    const resultDeficit = comprehensionEngine.comprehend(textDeficit);
    assert.ok(resultDeficit.relationships.some(r => r.type === 'deficit'));

    // running style + distance preference relation
    const textTactical = 'I need front runner with long distance setup';
    const resultTactical = comprehensionEngine.comprehend(textTactical);
    assert.ok(resultTactical.relationships.some(r => r.type === 'tactical_setup'));
  });

  await t.test('F5.4 Context building', () => {
    const text = 'I keep losing Arima Kinen with Oguri Cap.';
    const result = comprehensionEngine.comprehend(text);

    assert.ok(result.context);
    assert.strictEqual(result.context.character, 'Oguri Cap');
    assert.strictEqual(result.context.event, 'Arima Kinen');
    assert.strictEqual(result.context.problem, 'losing');
  });

  await t.test('F5.5 Number comprehension', () => {
    const result1 = comprehensionEngine.comprehend('I have 150M fans on Nakayama.');
    const numFact = result1.numbers.find(n => n.original === '150M');
    assert.ok(numFact);
    assert.strictEqual(numFact.value, 150000000);

    const result2 = comprehensionEngine.comprehend('Distance is 2500m.');
    const metersFact = result2.numbers.find(n => n.original === '2500m');
    assert.ok(metersFact);
    assert.strictEqual(metersFact.value, 2500);
  });

  await t.test('F5.6 Semantic classification', () => {
    const result = comprehensionEngine.comprehend('Need Front Runner parent.');
    assert.ok(result.categories.includes('parent_inquiry'));
    assert.ok(result.categories.includes('tactical_running_style'));
  });

  await t.test('F5.7 Multi-sentence understanding', () => {
    const text = 'I have 120M fans. The requirement is 150M. I am worried.';
    const result = comprehensionEngine.comprehend(text);

    assert.ok(result.context);
    assert.strictEqual(result.context.currentFans, 120000000);
    assert.strictEqual(result.context.requiredFans, 150000000);
    assert.strictEqual(result.context.emotion, 'concern');
  });

  await t.test('F5.8 Taxonomy-aware comprehension', () => {
    // Testing resolving taxonomy aliases ('nige') to canonical taxonomy items
    const text = 'Need nige parent.';
    const result = comprehensionEngine.comprehend(text);
    
    // Check taxonomy mapping via glossary entity extraction
    assert.ok(result.entities.some(e => e.name === 'Front Runner' && e.domain === 'Umamusume'));
  });

  await t.test('F5.9 Confidence scoring', () => {
    const emptyResult = comprehensionEngine.comprehend('');
    const fullResult = comprehensionEngine.comprehend('Oguri Cap Speed: 1200 Stamina: 800. Trainer has 120M fans.');

    assert.strictEqual(emptyResult.confidence, 0.5);
    assert.ok(fullResult.confidence > 0.5);
  });

  await t.test('F5.10 LanguageCore integration', async () => {
    const response = await coreService.analyze('I keep losing Arima Kinen with Oguri Cap.');
    
    assert.ok(response.comprehension);
    assert.strictEqual(response.comprehension.context?.character, 'Oguri Cap');
    assert.strictEqual(response.comprehension.context?.event, 'Arima Kinen');
    assert.strictEqual(response.comprehension.context?.problem, 'losing');
  });
});
