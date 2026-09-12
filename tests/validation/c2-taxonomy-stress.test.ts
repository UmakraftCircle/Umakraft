import { test } from 'node:test';
import assert from 'node:assert';
import { TaxonomyResolver } from '../../packages/lily-ai/src/services/language/taxonomy-resolver.js';
import { TaxonomyMatch } from '../../packages/lily-ai/src/services/language/language-analysis.js';

test('C2 — Taxonomy Stress Testing', async (t) => {
  const resolver = new TaxonomyResolver();

  const runTest = (input: string, expectedTypes: string[], expectedValues: string[]) => {
    const matches = resolver.resolve(input);
    expectedTypes.forEach((type, index) => {
      const match = matches.find(m => m.type === type);
      assert.ok(match, `Expected match of type ${type} for input "${input}"`);
      assert.strictEqual(match?.value, expectedValues[index], `Expected value ${expectedValues[index]} for type ${type} in input "${input}"`);
    });
  };

  await t.test('C2.1 — JP Alias Resolution', () => {
    runTest("nige", ['running_style'], ['Front Runner']);
    runTest("senkou", ['running_style'], ['Pace Chaser']);
    runTest("sashi", ['running_style'], ['Late Surger']);
    runTest("oikomi", ['running_style'], ['End Closer']);
  });

  await t.test('C2.2 — Mixed Global + JP', () => {
    runTest("long nige parent", ['distance', 'running_style'], ['Long', 'Front Runner']);
    runTest("sashi mile parent", ['running_style', 'distance'], ['Late Surger', 'Mile']);
  });
  
  // Note: I will need to expand the test as I see results
});
