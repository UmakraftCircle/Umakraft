import { test } from 'node:test';
import assert from 'node:assert';
import {
  LanguageCoreService,
  CommunicationEngine
} from '../../packages/lily-ai/src/language-core/index.js';

test('F8 — Communication Intelligence Engine', async (t) => {
  const commEngine = new CommunicationEngine();
  const coreService = new LanguageCoreService();

  await t.test('1. Audience detection', () => {
    const detector = commEngine.getAudienceDetector();

    const aud1 = detector.detect('Hello Coach, I need help.');
    assert.strictEqual(aud1.audienceType, 'Trainer');
    assert.ok(aud1.confidence >= 0.9);

    const aud2 = detector.detect('Officer, please review this link.');
    assert.strictEqual(aud2.audienceType, 'Officer');
    assert.ok(aud2.confidence >= 0.9);

    const aud3 = detector.detect('Hey leader, are we ready?');
    assert.strictEqual(aud3.audienceType, 'Leader');

    const aud4 = detector.detect('I am a new member of the club.');
    assert.strictEqual(aud4.audienceType, 'New Member');
  });

  await t.test('2. Strategy selection', () => {
    const strategyEngine = commEngine.getResponseStrategyEngine();

    const strat1 = strategyEngine.determine({ text: 'What is Front Runner?' });
    assert.strictEqual(strat1, 'Explain');

    const strat2 = strategyEngine.determine({ text: 'I keep losing races.' });
    assert.strictEqual(strat2, 'Coach');

    const strat3 = strategyEngine.determine({ text: 'Find parent', goal: 'Parent Search' });
    assert.strictEqual(strat3, 'Coach');

    const strat4 = strategyEngine.determine({ text: 'Finally hit 200M fans!' });
    assert.strictEqual(strat4, 'Celebrate');
  });

  await t.test('3. Style selection', () => {
    const styleEngine = commEngine.getStyleEngine();

    const style1 = styleEngine.select({ text: 'OK' });
    assert.strictEqual(style1, 'Short');

    const style2 = styleEngine.select({ text: 'what is Front Runner' });
    assert.strictEqual(style2, 'Beginner');

    const style3 = styleEngine.select({ text: 'Need a factor inheritance optimization formula.' });
    assert.strictEqual(style3, 'Expert');

    const style4 = styleEngine.select({ text: 'Standard sentence text build query.' });
    assert.strictEqual(style4, 'Standard');
  });

  await t.test('4. Empathy behavior', () => {
    const empathyEngine = commEngine.getEmpathyEngine();

    const empFrustrated = empathyEngine.adjust('Frustrated');
    assert.strictEqual(empFrustrated.tone, 'Supportive');
    assert.strictEqual(empFrustrated.celebrationAllowed, false);

    const empHappy = empathyEngine.adjust('Happy');
    assert.strictEqual(empHappy.tone, 'Enthusiastic');
    assert.strictEqual(empHappy.celebrationAllowed, true);

    const empConfused = empathyEngine.adjust('Confused');
    assert.strictEqual(empConfused.tone, 'Patient');
  });

  await t.test('5. Clarification integration', () => {
    const clarificationStrategy = commEngine.getClarificationStrategy();

    const mapped = clarificationStrategy.mapStrategy({
      type: 'direct',
      reason: 'ambiguous_term',
      question: 'Which running style do you mean?'
    });
    assert.strictEqual(mapped.clarificationType, 'Direct');
    assert.strictEqual(mapped.formattedQuestion, 'Which running style do you mean?');
  });

  await t.test('6. Prioritization', () => {
    const prioritizer = commEngine.getPrioritizer();

    const list1 = prioritizer.prioritize({ text: 'I keep losing races.' });
    assert.ok(list1[0].startsWith('Critical: Fix Stat deficits'));

    const list2 = prioritizer.prioritize({ text: 'Need parent', goal: 'Parent Search' });
    assert.ok(list2[0].startsWith('Critical: User intent resolution'));
    assert.ok(list2[1].startsWith('Important: Running style and distance compatibility'));
  });

  await t.test('7. Context continuity', () => {
    const context = commEngine.getContext();
    context.delete('session-99');

    context.update('session-99', { lastTopic: 'Build Help', lastStrategy: 'Coach' });
    const state = context.get('session-99');
    assert.ok(state);
    assert.strictEqual(state.lastTopic, 'Build Help');
    assert.strictEqual(state.lastStrategy, 'Coach');
    assert.strictEqual(state.turnsActive, 1);
  });

  await t.test('8. Intent framing', () => {
    const strategyEngine = commEngine.getResponseStrategyEngine();

    const intentFraming1 = strategyEngine.determine({ text: 'Explain Speed Stat.' });
    assert.strictEqual(intentFraming1, 'Explain');

    const intentFraming2 = strategyEngine.determine({ text: 'Setup parent link.', goal: 'Link Request' });
    assert.strictEqual(intentFraming2, 'Guide');
  });

  await t.test('9. Communication output', () => {
    const result = commEngine.communicate({
      sessionId: 'test-session',
      text: 'I keep losing Arima Kinen.',
      goal: 'Race Help',
      emotion: 'Frustrated'
    });

    assert.strictEqual(result.strategy, 'Coach');
    assert.strictEqual(result.tone, 'Supportive');
    assert.strictEqual(result.style, 'Standard');
    assert.ok(result.priority.length > 0);
  });

  await t.test('10. LanguageCore integration', async () => {
    const result = await coreService.analyze('Hello Coach, what is Front Runner?');
    assert.ok(result.communication);
    assert.strictEqual(result.communication.audience, 'Trainer');
    assert.strictEqual(result.communication.strategy, 'Explain');
    assert.strictEqual(result.communication.style, 'Beginner');
  });
});
