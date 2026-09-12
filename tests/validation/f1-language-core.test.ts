import { test } from 'node:test';
import assert from 'node:assert';
import {
  CharacterEngine,
  Tokenizer,
  SentenceParser,
  DictionaryService,
  GlossaryService,
  ReadingEngine,
  WritingEngine,
  ComprehensionEngine,
  ReasoningEngine,
  LanguageCoreService
} from '../../packages/lily-ai/src/language-core/index.js';

test('F1 — LanguageCoreService Foundation', async (t) => {
  const charEngine = new CharacterEngine();
  const tokenizer = new Tokenizer();
  const sentenceParser = new SentenceParser();
  const dictionaryService = new DictionaryService();
  const glossaryService = new GlossaryService();
  const readingEngine = new ReadingEngine();
  const writingEngine = new WritingEngine();
  const comprehensionEngine = new ComprehensionEngine();
  const reasoningEngine = new ReasoningEngine();
  const coreService = new LanguageCoreService();

  await t.test('F1.1 Character Analysis', () => {
    const analysis = charEngine.analyze('Oguri Cap 1!');
    assert.strictEqual(analysis.length, 12);
    assert.strictEqual(analysis.hasNumbers, true);
    assert.strictEqual(analysis.hasSymbols, true);
    assert.strictEqual(analysis.hasLetters, true);
  });

  await t.test('F1.2 Tokenization', () => {
    const tokens = tokenizer.tokenize('Need long runner parent');
    assert.strictEqual(tokens.length, 4);
    assert.strictEqual(tokens[0].text, 'need');
    assert.strictEqual(tokens[1].text, 'long');
    assert.strictEqual(tokens[2].text, 'runner');
    assert.strictEqual(tokens[3].text, 'parent');
  });

  await t.test('F1.3 Sentence Parsing', () => {
    const sentences = sentenceParser.parse('I need a parent. Can you help me?');
    assert.strictEqual(sentences.length, 2);
    assert.strictEqual(sentences[0].text, 'I need a parent.');
    assert.strictEqual(sentences[1].text, 'Can you help me?');
  });

  await t.test('F1.4 Dictionary Lookup', () => {
    const entry = dictionaryService.lookup('parent');
    assert.ok(entry);
    assert.strictEqual(entry.partOfSpeech, 'noun');
    assert.strictEqual(entry.synonyms.includes('lineage'), true);
  });

  await t.test('F1.5 Glossary Lookup', () => {
    const matched = glossaryService.matchTerms('What strategy is Front Runner?');
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].term, 'Front Runner');
  });

  await t.test('F1.6 Number Extraction (Reading Engine)', () => {
    const extracted = readingEngine.extractInfo('Current Fans: 80M Required Fans: 150M');
    assert.strictEqual(extracted.numbers.length, 2);
    assert.strictEqual(extracted.numbers[0], 80);
    assert.strictEqual(extracted.numbers[1], 150);
  });

  await t.test('F1.7 Text Normalization (Writing Engine)', () => {
    const normalized = writingEngine.cleanText('  Need    parent...  ');
    assert.strictEqual(normalized, 'Need parent...');
  });

  await t.test('F1.8 Reasoning (Comparison & Arithmetic)', () => {
    const comparison = reasoningEngine.compare(10, 5);
    assert.strictEqual(comparison, 'GREATER');

    const diff = reasoningEngine.difference(150, 120);
    assert.strictEqual(diff, 30);
  });

  await t.test('F1.9 LanguageCoreService Pipeline', async () => {
    const analysis = await coreService.analyze('I need a Front Runner parent. Can you help me?');
    assert.strictEqual(analysis.sentences.length, 2);
    assert.strictEqual(analysis.entities.includes('Front Runner'), true);
    // 'front' or 'runner' or 'parent' or 'need' are known, but helper/interjections like 'me' aren't seeded in dictionary
    assert.ok(analysis.tokens.length > 5);
    assert.strictEqual(analysis.normalizedText, 'I need a Front Runner parent. Can you help me?');
  });
});
