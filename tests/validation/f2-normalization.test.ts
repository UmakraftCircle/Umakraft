import { test } from 'node:test';
import assert from 'node:assert';
import {
  NormalizationEngine,
  FuzzyMatcher,
  AliasService,
  CorrectionConfidence,
  TypoCorrectionService
} from '../../packages/lily-ai/src/language-core/normalization/index.js';
import { LanguageCoreService } from '../../packages/lily-ai/src/language-core/index.js';

test('F2 — Typo Correction & Normalization Engine', async (t) => {
  const normEngine = new NormalizationEngine();
  const fuzzyMatcher = new FuzzyMatcher();
  const aliasService = new AliasService();
  const correctionService = new TypoCorrectionService();
  const coreService = new LanguageCoreService();

  await t.test('F2.1 Typo Correction Service (Simple typos)', () => {
    const result1 = correctionService.correct('oguri capp');
    assert.strictEqual(result1.corrected, 'Oguri Cap');
    assert.strictEqual(result1.confidence, CorrectionConfidence.HIGH);

    const result2 = correctionService.correct('frontruner');
    assert.strictEqual(result2.corrected, 'Front Runner');
  });

  await t.test('F2.2 Alias Resolution', () => {
    const canonical = aliasService.resolve('nige');
    assert.strictEqual(canonical, 'Front Runner');

    const canonical2 = aliasService.resolve('oikomi');
    assert.strictEqual(canonical2, 'End Closer');
  });

  await t.test('F2.3 Fuzzy Matching Engine (Levenshtein)', () => {
    const dist = fuzzyMatcher.getDistance('kitasan', 'kitasann');
    assert.strictEqual(dist, 1);

    const matches = fuzzyMatcher.match('kitasan blak', ['Kitasan Black', 'Oguri Cap']);
    assert.strictEqual(matches[0].candidate, 'Kitasan Black');
    assert.ok(matches[0].similarity > 0.8);
  });

  await t.test('F2.4 OCR Cleanup', () => {
    const cleaned = correctionService.cleanOCRErrors('Fr0nt Runner and Kitasan B1ack');
    assert.strictEqual(cleaned, 'Front Runner and Kitasan Black');
  });

  await t.test('F2.5 Ambiguous Corrections detection', () => {
    const isAmb = correctionService.isAmbiguous('speed');
    assert.strictEqual(isAmb, true);

    const norm = normEngine.normalize('speed');
    assert.strictEqual(norm.needsClarification, true);
  });

  await t.test('F2.6 Language Cache Behavior', () => {
    normEngine.normalize('kitasan blak');
    // Calling a second time should fetch from cache
    const normResult = normEngine.normalize('kitasan blak');
    assert.ok(normResult.corrections.length > 0);
    assert.strictEqual(normResult.corrections[0].source, 'cache');
  });

  await t.test('F2.7 Normalization Pipeline & Multi-Pass', () => {
    const pipelineResult = normEngine.normalize('need frontruner parent');
    assert.strictEqual(pipelineResult.normalizedText, 'need Front Runner parent');
  });

  await t.test('F2.8 LanguageCore Integration Pipeline', async () => {
    const analysis = await coreService.analyze('need nige parent and oguri capp build');
    assert.strictEqual(analysis.normalizedText, 'need Front Runner parent and Oguri Cap build');
    assert.ok(analysis.corrections && analysis.corrections.length >= 2);
  });
});
