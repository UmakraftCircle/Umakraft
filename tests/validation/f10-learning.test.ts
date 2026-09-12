import { test } from 'node:test';
import assert from 'node:assert';
import {
  LanguageCoreService,
  LearningEngine,
  ObservationEngine,
  PatternCollector,
  CandidateGenerator,
  VocabularyLearning,
  GlossaryLearning,
  TaxonomyLearning,
  ApprovalQueue,
  LearningMemory,
  LearningConfidenceEngine
} from '../../packages/lily-ai/src/language-core/index.js';

test('F10 — Learning Foundation Engine', async (t) => {
  const learningEngine = new LearningEngine();
  const coreService = new LanguageCoreService();

  await t.test('1. Observation tracking', () => {
    const obsEngine = learningEngine.getObservationEngine();
    obsEngine.clear();

    // Observe "uma guide"
    obsEngine.observe('uma guide', 'query 1', 142);
    const obs = obsEngine.observe('uma guide', 'query 2', 1);

    assert.strictEqual(obs.term, 'uma guide');
    assert.strictEqual(obs.frequency, 143);
    assert.ok(obs.contexts?.includes('query 1'));
    assert.ok(obs.contexts?.includes('query 2'));

    const retrieved = obsEngine.getObservation('UMA GUIDE');
    assert.strictEqual(retrieved?.frequency, 143);
  });

  await t.test('2. Pattern collection', () => {
    const collector = learningEngine.getPatternCollector();
    collector.clear();

    // Repeated patterns: Need parent, Need front runner parent, Need long parent
    const p1 = collector.collect('Need parent');
    const p2 = collector.collect('Need front runner parent');
    const p3 = collector.collect('Need long parent');

    assert.ok(p1.some(p => p.category === 'parent_search'));
    assert.ok(p2.some(p => p.category === 'parent_search'));
    assert.ok(p3.some(p => p.category === 'parent_search'));

    const parentSearch = collector.getPattern('parent_search');
    assert.ok(parentSearch);
    assert.strictEqual(parentSearch.frequency, 3);

    // Leaderboard pattern
    const lb = collector.collect('Fan leaderboard and ranking');
    assert.ok(lb.some(p => p.category === 'leaderboard'));
  });

  await t.test('3. Candidate generation', () => {
    const generator = learningEngine.getCandidateGenerator();

    // Unknown word: poggers seen 240 times
    const candidate = generator.detectAndGenerate('poggers', 240);
    assert.ok(candidate);
    assert.strictEqual(candidate.term, 'poggers');
    assert.strictEqual(candidate.candidateType, 'dictionary');
    assert.strictEqual(candidate.value, 'poggers');
    assert.ok(candidate.confidence >= 0.90);

    // Multi-word phrase: blue spark route seen 120 times
    const glossaryCand = generator.detectAndGenerate('blue spark route', 120);
    assert.ok(glossaryCand);
    assert.strictEqual(glossaryCand.term, 'blue spark route');
    assert.strictEqual(glossaryCand.candidateType, 'glossary');
    assert.strictEqual(glossaryCand.value, 'blue spark route');
  });

  await t.test('4. Vocabulary learning', () => {
    const vocab = learningEngine.getVocabularyLearning();

    // Reroll seen repeatedly with high confidence
    const cand = vocab.evaluate({
      word: 'reroll',
      frequency: 150,
      contexts: ['how to reroll account']
    });

    assert.ok(cand);
    assert.strictEqual(cand.word, 'reroll');
    assert.strictEqual(cand.type, 'dictionary_candidate');
    assert.strictEqual(cand.candidateType, 'dictionary');

    // Rare word (e.g. frequency 2) should NOT become a candidate
    const rare = vocab.evaluate({
      word: 'randomgibberishxyz',
      frequency: 2
    });
    assert.strictEqual(rare, undefined);
  });

  await t.test('5. Glossary learning', () => {
    const glossary = learningEngine.getGlossaryLearning();

    const cand = glossary.evaluate({
      term: 'blue spark route',
      frequency: 120,
      domain: 'Umamusume'
    });

    assert.ok(cand);
    assert.strictEqual(cand.term, 'blue spark route');
    assert.strictEqual(cand.domain, 'Umamusume');
    assert.strictEqual(cand.type, 'glossary_candidate');
    assert.strictEqual(cand.candidateType, 'glossary');
  });

  await t.test('6. Taxonomy learning', () => {
    const taxonomy = learningEngine.getTaxonomyLearning();

    // New Character Name suggestion
    const cand = taxonomy.evaluate({
      name: 'Gentildonna',
      category: 'character',
      frequency: 110,
      contexts: ['When is Gentildonna banner?']
    });

    assert.ok(cand);
    assert.strictEqual(cand.candidateType, 'taxonomy');
    assert.strictEqual(cand.term, 'Gentildonna');
    assert.strictEqual(cand.metadata?.category, 'character');

    // Existing canonical term should NOT generate candidate
    const existing = taxonomy.evaluate({
      name: 'Front Runner',
      category: 'running_style',
      frequency: 200
    });
    assert.strictEqual(existing, undefined);
  });

  await t.test('7. Confidence scoring', () => {
    const confidence = new LearningConfidenceEngine();

    // High frequency (>= 100) -> Candidate (>= 0.90)
    const highConf = confidence.evaluate({ frequency: 240 });
    assert.ok(highConf >= 0.90);
    assert.strictEqual(confidence.getRecommendation(highConf), 'candidate');

    // Moderate frequency (20 - 40) -> Observe Longer (0.70 - 0.89)
    const medConf = confidence.evaluate({ frequency: 25, consistency: 0.8, sourceQuality: 0.8, patternStrength: 0.8 });
    assert.ok(medConf >= 0.70 && medConf < 0.90);
    assert.strictEqual(confidence.getRecommendation(medConf), 'observe_longer');

    // Low frequency (< 10) -> Ignore (< 0.70)
    const lowConf = confidence.evaluate({ frequency: 3 });
    assert.ok(lowConf < 0.70);
    assert.strictEqual(confidence.getRecommendation(lowConf), 'ignore');
  });

  await t.test('8. Approval queue', () => {
    const queue = learningEngine.getApprovalQueue();
    queue.clear();

    const candidate = queue.submit({
      id: 'cand_123',
      type: 'dictionary',
      value: 'poggers',
      confidence: 0.95,
      evidence: ['Seen 240 times']
    });

    assert.strictEqual(candidate.status, 'pending_review');
    assert.strictEqual(queue.getPending().length, 1);

    // Human developer review & approval
    const approved = queue.approve('cand_123');
    assert.strictEqual(approved?.status, 'approved');
    assert.strictEqual(queue.getPending().length, 0);
  });

  await t.test('9. Learning memory', () => {
    const memory = learningEngine.getLearningMemory();
    memory.clear();

    const record = memory.track('reroll', 150, 'pending_review');
    assert.strictEqual(record.term, 'reroll');
    assert.strictEqual(record.seen, 150);
    assert.strictEqual(record.status, 'pending_review');

    // Update status upon human review
    memory.updateStatus('reroll', 'approved');
    assert.strictEqual(memory.get('reroll')?.status, 'approved');
  });

  await t.test('10. LanguageCore integration', async () => {
    assert.ok(coreService.getLearningEngine() instanceof LearningEngine);

    // Seed observation frequency for "poggers" so it crosses threshold in pipeline test
    const obsEngine = coreService.getLearningEngine().getObservationEngine();
    obsEngine.observe('poggers', 'prior observation', 240);

    const result = await coreService.analyze(
      'poggers Need front runner parent for mile race.'
    );

    assert.ok(result.learning, 'LanguageCoreResult must include learning property');
    assert.ok(Array.isArray(result.learning.observations));
    assert.ok(Array.isArray(result.learning.patterns));
    assert.ok(Array.isArray(result.learning.candidates));
    assert.strictEqual(typeof result.learning.confidence, 'number');

    // Verify pattern collected
    assert.ok(result.learning.patterns.some(p => p.category === 'parent_search'));

    // Verify candidate was generated without modifying dictionary/taxonomy automatically
    const poggersCand = result.learning.candidates.find(c => c.term === 'poggers' || c.value === 'poggers');
    assert.ok(poggersCand);
    assert.strictEqual(poggersCand.candidateType, 'dictionary');

    // Verify dictionary remains pristine (not modified without review/approval)
    assert.strictEqual(coreService.getDictionaryService().lookup('poggers'), undefined);
  });
});
