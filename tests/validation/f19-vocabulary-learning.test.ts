import { test } from 'node:test';
import assert from 'node:assert';
import {
  VocabularyLearningEngine,
  CandidateRegistry,
  CandidateDetector,
  CandidateScorer,
  CandidateReviewer,
  CandidatePromoter,
  CandidateCache,
  LearningStatistics,
  DEFAULT_LEARNING_POLICY,
  DictionaryKnowledgeProvider,
  DefinitionKnowledgeProvider,
  DictionaryRegistry,
  DefinitionRegistry
} from '../../packages/lily-ai/src/vocabulary/index.js';
import { LilyLanguageService } from '../../packages/lily-ai/src/services/language/lily-language-service.js';

test('F19 — Vocabulary Learning Engine', async (t) => {
  await t.test('1. Candidate Detection & Noise Filtering', () => {
    const engine = new VocabularyLearningEngine();
    const detector = engine.getDetector();

    // 1. Detect unknown word in sentence
    const results = detector.detect('We discovered a serendipitous resplendence in the trial race.');
    const terms = results.map(r => r.term);
    assert.ok(terms.includes('resplendence'));

    // 2. Filter pure gibberish and keyboard mash
    const mash1 = detector.checkPlausibility('asdfghjk');
    assert.strictEqual(mash1.plausible, false);

    const mash2 = detector.checkPlausibility('aaaaaa');
    assert.strictEqual(mash2.plausible, false);

    const mash3 = detector.checkPlausibility('xjzqqw');
    assert.strictEqual(mash3.plausible, false);

    // 3. Known dictionary words are NOT candidates
    const knownResults = detector.detect('Speed and stamina and power make a runner fast.');
    assert.strictEqual(knownResults.length, 0);
  });

  await t.test('2. Observation, Tracking, and Frequency Scoring', () => {
    const engine = new VocabularyLearningEngine();

    // Single observation
    const observed1 = engine.observe('That run was poggers!', { userId: 'trainer1' });
    assert.strictEqual(observed1.length, 1);
    assert.strictEqual(observed1[0].term, 'poggers');
    assert.strictEqual(observed1[0].frequency, 1);
    assert.strictEqual(observed1[0].status, 'PENDING');

    // Repeated observations from different users
    engine.observe('That was a super poggers finish in the final stretch.', { userId: 'trainer2' });
    engine.observe('Poggers strategy for the stamina cup.', { userId: 'trainer3' });

    const candidate = engine.getRegistry().get('poggers');
    assert.ok(candidate);
    assert.strictEqual(candidate.frequency, 3);
    assert.strictEqual(candidate.uniqueUsers.length, 3);
    assert.ok(candidate.confidence > 0.40);
    assert.ok(candidate.contextSamples.length >= 3);
  });

  await t.test('3. Critical Rule: Zero Automatic Promotion to Production Vocabulary', () => {
    const dictProvider = new DictionaryKnowledgeProvider();
    const defProvider = new DefinitionKnowledgeProvider();
    const engine = new VocabularyLearningEngine(DEFAULT_LEARNING_POLICY, {
      dictionaryProvider: dictProvider,
      definitionProvider: defProvider
    });

    // Observe word 100 times
    for (let i = 0; i < 100; i++) {
      engine.observe(`Another test of ultrabuild in race ${i}`, { userId: `user_${i}` });
    }

    const candidate = engine.getRegistry().get('ultrabuild');
    assert.ok(candidate);
    assert.strictEqual(candidate.frequency, 100);
    assert.strictEqual(candidate.status, 'PENDING');

    // Critical check: It must NOT exist in production dictionary without review
    assert.strictEqual(dictProvider.exists('ultrabuild'), false);
    assert.strictEqual(defProvider.exists('ultrabuild'), false);

    // Direct promotion of unapproved candidate MUST fail
    const promotionAttempt = engine.promote('ultrabuild');
    assert.strictEqual(promotionAttempt.success, false);
    assert.ok(promotionAttempt.error?.includes('must be \'APPROVED\''));
  });

  await t.test('4. Human Review Workflow (Queue, Approve, Reject, Edit)', () => {
    const engine = new VocabularyLearningEngine();

    // Seed multiple candidates
    engine.observe('The new meta requires an hyperdrive setup.', { userId: 'u1' });
    engine.observe('Check out this hyperdrive build.', { userId: 'u2' });
    engine.observe('Hyperdrive is really strong today.', { userId: 'u3' });
    engine.observe('Spamming asdfghjk is annoying.', { userId: 'spammer' });

    // Review queue should surface high confidence candidates
    const queue = engine.getReviewQueue();
    assert.ok(queue.some(c => c.term === 'hyperdrive'));

    // Admin rejects spam
    const rejectRes = engine.reject('asdfghjk', 'admin_1', 'Keyboard mash spam');
    assert.strictEqual(rejectRes, true);
    assert.strictEqual(engine.getRegistry().get('asdfghjk')?.status, 'REJECTED');

    // Admin edits and approves legitimate candidate
    engine.edit('hyperdrive', {
      suggestedDefinition: 'A high-acceleration setup focusing on explosive burst speed',
      partOfSpeech: 'noun',
      category: 'community'
    });

    const approveRes = engine.approve('hyperdrive', 'admin_1', 'Validated community term');
    assert.strictEqual(approveRes, true);
    assert.strictEqual(engine.getRegistry().get('hyperdrive')?.status, 'APPROVED');
  });

  await t.test('5. Safe Promotion to Production Registries with Authority 50', () => {
    const dictRegistry = new DictionaryRegistry();
    const defRegistry = new DefinitionRegistry();
    const engine = new VocabularyLearningEngine();

    // Track, approve, and promote
    engine.track('powerdrift', 'Using powerdrift to overtake on the outer curve', 'u1', 'racing');
    engine.track('powerdrift', 'Clean powerdrift on the final corner', 'u2', 'racing');
    engine.track('powerdrift', 'Powerdrift setup executed flawlessly', 'u3', 'racing');

    // Approve
    engine.approve('powerdrift', 'admin_curator', 'Approved racing technique', 'A tactical cornering maneuver to maintain momentum on outer bends.');

    // Promote
    const promoRes = engine.promote('powerdrift', {
      promoterId: 'admin_curator',
      dictionaryRegistry: dictRegistry,
      definitionRegistry: defRegistry
    });

    assert.strictEqual(promoRes.success, true);
    assert.strictEqual(promoRes.candidate?.status, 'PROMOTED');

    // Verify injected entry into Dictionary Registry
    const dictEntry = dictRegistry.get('powerdrift');
    assert.ok(dictEntry);
    assert.strictEqual(dictEntry.word, 'powerdrift');
    assert.ok(dictEntry.definitions[0].includes('tactical cornering maneuver'));

    // Verify injected entry into Definition Registry
    const defEntry = defRegistry.get('powerdrift');
    assert.ok(defEntry);
    assert.strictEqual(defEntry.word, 'powerdrift');
    assert.strictEqual(defEntry.source, 'learned_candidate');
    assert.strictEqual(defEntry.authority, 50);

    // Verify statistics & promotion history
    const stats = engine.getStatistics();
    assert.strictEqual(stats.candidatesPromoted, 1);
    assert.strictEqual(engine.getPromotionHistory().length, 1);
  });

  await t.test('6. Integration with LilyLanguageService Analysis Pipeline', () => {
    const service = new LilyLanguageService();
    const learningEngine = service.getLearningEngine();

    // Process a message containing an unknown term
    const analysis = service.analyze('That was an unbelievable hyperspeed spurt!');
    assert.ok(analysis.observedCandidates);
    assert.ok(analysis.observedCandidates.some(c => c.term === 'hyperspeed'));

    // Check that candidate was automatically tracked in learning engine
    const candidate = learningEngine.getRegistry().get('hyperspeed');
    assert.ok(candidate);
    assert.strictEqual(candidate.status, 'PENDING');
  });
});
