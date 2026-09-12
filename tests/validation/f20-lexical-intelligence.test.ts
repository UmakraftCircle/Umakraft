import { test } from 'node:test';
import assert from 'node:assert';
import {
  LilyLexicalIntelligence,
  LexicalOrchestrator,
  LexicalRouter,
  LexicalContextResolver,
  LexicalConfidenceAggregator,
  LexicalCache,
  LexicalQuery,
  LexicalResult
} from '../../packages/lily-ai/src/language/lexical/index.js';
import { KnowledgeEngine } from '../../packages/lily-ai/src/knowledge/knowledge-engine.js';
import { LilyLanguageService } from '../../packages/lily-ai/src/services/language/lily-language-service.js';

test('F20 — Lexical Intelligence Layer', async (t) => {
  const lexical = new LilyLexicalIntelligence();

  await t.test('1. Lexical Routing', () => {
    const router = new LexicalRouter();

    const decision1 = router.route('stamina');
    assert.strictEqual(decision1.primaryRoute, 'dictionary');
    assert.strictEqual(decision1.isMultiWord, false);

    const decision2 = router.route('break a leg');
    assert.strictEqual(decision2.primaryRoute, 'phrase');
    assert.strictEqual(decision2.isIdiomOrPhrase, true);
    assert.strictEqual(decision2.phraseMeaning, 'good luck');

    const decision3 = router.route('front runner');
    assert.strictEqual(decision3.primaryRoute, 'phrase');
    assert.strictEqual(decision3.isMultiWord, true);
    assert.ok(decision3.phraseMeaning?.includes('competitor who leads'));

    const decision4 = router.route({
      text: 'fast',
      options: { includeSynonyms: true }
    });
    assert.strictEqual(decision4.primaryRoute, 'synonym');

    const decision5 = router.route({
      text: 'accelerate',
      options: { includeAntonyms: true }
    });
    assert.strictEqual(decision5.primaryRoute, 'antonym');
  });

  await t.test('2. Dictionary Integration', () => {
    const res = lexical.lookup('speed');
    assert.strictEqual(res.term, 'speed');
    assert.ok(res.definition);
    assert.ok(res.partOfSpeech);
    assert.ok(res.confidence >= 0.90);
    assert.strictEqual(res.candidate, undefined);

    const res2 = lexical.lookup('stamina');
    assert.ok(res2.definition);
    assert.ok(res2.sources?.includes('dictionary'));
  });

  await t.test('3. Synonym Integration', () => {
    const synonyms = lexical.findSynonyms('speed');
    assert.ok(synonyms.length > 0);
    assert.ok(synonyms.includes('velocity'));

    const res = lexical.lookup('fast');
    assert.ok(res.synonyms);
    assert.ok(res.synonyms.length > 0);
  });

  await t.test('4. Antonym Integration', () => {
    const antonyms = lexical.findAntonyms('accelerate');
    assert.ok(antonyms.length > 0);
    assert.ok(antonyms.includes('decelerate'));

    const res = lexical.lookup('lead');
    assert.ok(res.antonyms);
    assert.ok(res.antonyms.length > 0);
  });

  await t.test('5. Phrase Integration', () => {
    const analysis1 = lexical.analyzePhrase('break a leg');
    assert.strictEqual(analysis1.isPhrase, true);
    assert.strictEqual(analysis1.meaning, 'good luck');
    assert.deepStrictEqual(analysis1.tokens, ['break', 'a', 'leg']);

    const analysis2 = lexical.analyzePhrase('front runner');
    assert.strictEqual(analysis2.isPhrase, true);
    assert.ok(analysis2.phraseMeaning?.includes('competitor who leads'));
    assert.deepStrictEqual(analysis2.tokens, ['front', 'runner']);

    const analysis3 = lexical.analyzePhrase('fast runner');
    assert.strictEqual(analysis3.isPhrase, true);
    assert.ok(analysis3.expansions.length > 0);
  });

  await t.test('6. Definition Integration', () => {
    const def = lexical.define('spark');
    assert.ok(def);
    assert.strictEqual(typeof def, 'string');

    const def2 = lexical.define('break a leg');
    assert.strictEqual(def2, 'good luck');
  });

  await t.test('7. Learning Integration', () => {
    const res = lexical.lookup('poggers');
    assert.strictEqual(res.candidate, true);
    assert.ok(res.candidateInfo);
    assert.ok(res.sources?.includes('learning'));
    assert.ok(res.confidence < 0.60);

    const candidateResult = lexical.learnCandidate('hyperdriveboost');
    assert.ok(candidateResult);
  });

  await t.test('8. Confidence Aggregation', () => {
    const aggregator = new LexicalConfidenceAggregator();
    const highConf = aggregator.aggregate({
      dictionary: 0.95,
      definition: 0.92,
      synonym: 0.90,
      isExact: true
    });
    assert.ok(highConf >= 0.95);

    const candidateConf = aggregator.aggregate({
      isCandidate: true,
      vocabulary: 0.42
    });
    assert.ok(candidateConf <= 0.55);
  });

  await t.test('9. Semantic Expansion', () => {
    const exp = lexical.expand('quick runner');
    assert.ok(exp.terms.length > 0);
    assert.ok(exp.phrases.length > 0);
    assert.ok(exp.synonyms['quick'] || exp.synonyms['runner']);

    const exp2 = lexical.expand('swift');
    assert.ok(exp2.terms.includes('fast'));
  });

  await t.test('10. Context Resolution & Semantic Score', () => {
    const resolver = new LexicalContextResolver();
    const definitions = [
      'A person or animal that competes in races',
      'A software process executing automated background tasks',
      'A long narrow carpet placed in a hallway'
    ];
    const result = resolver.resolveContext('runner', 'Umamusume racetrack racing', definitions);
    assert.strictEqual(result.bestDefinition, definitions[0]);
    assert.strictEqual(result.domain, 'umamusume');

    const score1 = lexical.semanticScore('stamina', 'umamusume racing stat');
    assert.ok(score1 >= 0.85);

    const score2 = lexical.semanticScore('zyxwvu123');
    assert.ok(score2 <= 0.50);
  });

  await t.test('11. Knowledge & Language Service Integration', () => {
    const knowledgeEngine = new KnowledgeEngine();
    const sources = knowledgeEngine.getRegistry().getAll();
    const lexicalSource = sources.find(s => s.id === 'lexical_intelligence');
    assert.ok(lexicalSource);
    assert.strictEqual(lexicalSource?.priority, 80);
    assert.strictEqual(lexicalSource?.type, 'lexical');

    const taxonomy = sources.find(s => s.id === 'taxonomy');
    const database = sources.find(s => s.id === 'database');
    const handbook = sources.find(s => s.id === 'handbook');

    assert.strictEqual(taxonomy?.priority, 100);
    assert.strictEqual(handbook?.priority, 90);
    assert.strictEqual(database?.priority, 85);
    assert.strictEqual(lexicalSource?.priority, 80);

    const languageService = new LilyLanguageService();
    const analysis = languageService.analyze('How does stamina affect race speed?');
    assert.ok(analysis.definitions['stamina'] || analysis.definitions['speed']);
    assert.ok(languageService.getLexicalIntelligence() instanceof LilyLexicalIntelligence);
  });
});
