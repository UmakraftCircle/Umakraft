import { test } from 'node:test';
import assert from 'node:assert';
import {
  LanguageCoreService,
  UnderstandingEngine,
  ClarificationEngine
} from '../../packages/lily-ai/src/language-core/index.js';

test('F7 — Understanding Intelligence Engine', async (t) => {
  const understandingEngine = new UnderstandingEngine();
  const coreService = new LanguageCoreService();

  await t.test('F7.1 Meaning resolution', () => {
    const resolver = understandingEngine.getMeaningResolver();
    
    const meaning1 = resolver.resolve('Need Front Runner parent.', [], []);
    assert.strictEqual(meaning1.goal, 'Parent Search');
    assert.strictEqual(meaning1.runningStyle, 'Front Runner');

    const meaning2 = resolver.resolve('How do I improve Oguri Cap?', [], []);
    assert.strictEqual(meaning2.goal, 'Build Help');
    assert.strictEqual(meaning2.character, 'Oguri Cap');
  });

  await t.test('F7.2 Goal detection', () => {
    const detector = understandingEngine.getGoalDetector();

    assert.strictEqual(detector.detect('Show fan leaderboard.'), 'Leaderboard');
    assert.strictEqual(detector.detect('I need a front runner parent.'), 'Parent Search');
    assert.strictEqual(detector.detect('How do I build Oguri Cap?'), 'Build Help');
    assert.strictEqual(detector.detect('I keep losing Arima Kinen.'), 'Race Help');
    assert.strictEqual(detector.detect('Please explain what speed is.'), 'Learning');
  });

  await t.test('F7.3 Emotion detection', () => {
    const detector = understandingEngine.getEmotionDetector();

    assert.strictEqual(detector.detect('I keep losing every race!'), 'Frustrated');
    assert.strictEqual(detector.detect('I finally hit 200M fans!'), 'Happy');
    assert.strictEqual(detector.detect('What do you mean by that?'), 'Confused');
    assert.strictEqual(detector.detect('Please help me ASAP!'), 'Urgent');
    assert.strictEqual(detector.detect('Standard text with no emotion.'), 'Neutral');
  });

  await t.test('F7.4 Context understanding', () => {
    const contextUnderstanding = understandingEngine.getContextUnderstanding();

    // With previous context state containing character 'Oguri Cap'
    const contextState = { lastMentionedCharacter: 'Oguri Cap' };
    const resolved = contextUnderstanding.resolveContext('How should I build her?', contextState);
    assert.strictEqual(resolved.character, 'Oguri Cap');
    assert.strictEqual(resolved.contextResolved, true);
    assert.strictEqual(resolved.needsContext, false);

    // Without previous context state
    const emptyState = {};
    const unresolved = contextUnderstanding.resolveContext('How should I build her?', emptyState);
    assert.strictEqual(unresolved.contextResolved, false);
    assert.strictEqual(unresolved.needsContext, true);
  });

  await t.test('F7.5 Ambiguity detection', () => {
    const ambiguityEngine = understandingEngine.getAmbiguityEngine();

    const analysis1 = ambiguityEngine.analyze('Need speed parent.');
    assert.strictEqual(analysis1.ambiguous, true);
    assert.strictEqual(analysis1.clarificationNeeded, true);
    assert.ok(analysis1.options?.includes('Speed Factor'));

    const analysis2 = ambiguityEngine.analyze('I want to find a high speed factor parent.');
    assert.strictEqual(analysis2.ambiguous, false);
    assert.strictEqual(analysis2.clarificationNeeded, false);
  });

  await t.test('F7.6 Intent hints', () => {
    const hintsEngine = understandingEngine.getIntentHints();

    const hints = hintsEngine.generateHints('Need Front Runner parent.');
    assert.ok(hints.length > 0);
    assert.strictEqual(hints[0].possibleIntent, 'ParentSearch');
    assert.ok(hints[0].confidence > 0.9);
  });

  await t.test('F7.7 Confidence scoring', () => {
    const confidenceEngine = understandingEngine.getConfidenceEngine();

    // High confidence case
    const highConf = confidenceEngine.calculate({
      ambiguous: false,
      hasGoal: true,
      hasEmotion: true,
      contextResolved: true,
      wordCount: 10
    });
    assert.strictEqual(highConf.level, 'High');
    assert.ok(highConf.score >= 0.8);

    // Low confidence case
    const lowConf = confidenceEngine.calculate({
      ambiguous: true,
      hasGoal: false,
      hasEmotion: false,
      needsContext: true,
      wordCount: 2
    });
    assert.strictEqual(lowConf.level, 'Low');
    assert.ok(lowConf.score < 0.5);
  });

  await t.test('F7.8 Pattern tracking (Memory)', () => {
    const memory = understandingEngine.getMemory();
    memory.clear();

    // Learn pattern: shorthand "runner" -> "Front Runner"
    memory.learnPattern('runner', 'Front Runner');
    assert.strictEqual(memory.resolvePattern('runner'), 'Front Runner');
    assert.strictEqual(memory.getPatternStrength('runner'), 1);

    // Re-enforcing
    memory.learnPattern('runner', 'Front Runner');
    assert.strictEqual(memory.getPatternStrength('runner'), 2);

    // Clear memory
    memory.clear();
    assert.strictEqual(memory.resolvePattern('runner'), undefined);
  });

  await t.test('F7.9 Multi-sentence understanding', () => {
    const result = understandingEngine.understand(
      'I keep losing Arima Kinen. How can I build Oguri Cap to win?'
    );
    // Should detect Arima Kinen context and Oguri Cap
    assert.strictEqual(result.goal, 'Race Help');
    assert.strictEqual(result.emotion, 'Frustrated');
    assert.strictEqual((result.context as any).character, 'Oguri Cap');
    assert.strictEqual((result.context as any).event, 'Arima Kinen');
  });

  await t.test('F7.10 LanguageCore integration', async () => {
    // We should first mention Oguri Cap to set context
    const firstResult = await coreService.analyze('I want to build Oguri Cap.');
    assert.ok(firstResult.understanding);
    assert.strictEqual(firstResult.understanding.goal, 'Build Help');

    // Next sentence uses "her", should resolve to Oguri Cap
    const secondResult = await coreService.analyze('How should I train her?');
    assert.ok(secondResult.understanding);
    assert.strictEqual((secondResult.understanding.context as any).character, 'Oguri Cap');
    assert.strictEqual((secondResult.understanding.context as any).contextResolved, true);
  });

  await t.test('F7.5 — Clarification Intelligence Framework', async (tSub) => {
    const clarificationEngine = new ClarificationEngine();

    await tSub.test('F7.5A — Direct Clarification', () => {
      const result = clarificationEngine.evaluate({
        sessionId: 'session-1',
        text: 'Need speed parent.',
        confidence: 0.95,
        ambiguity: true,
        context: {}
      });

      assert.strictEqual(result.clarificationNeeded, true);
      assert.ok(result.clarification);
      assert.strictEqual(result.clarification.type, 'direct');
      assert.strictEqual(result.clarification.reason, 'ambiguous_term');
      assert.strictEqual(result.clarification.question, 'When you say "speed parent", which do you mean?');
      assert.deepStrictEqual(result.clarification.options, [
        'Speed Factor Parent',
        'Speed-focused Parent Build',
        'Speed Skill Inheritance'
      ]);
    });

    await tSub.test('F7.5B — Guided Clarification', () => {
      // Step 1: Initialize Guided Clarification with no existing fields
      const result1 = clarificationEngine.evaluate({
        sessionId: 'session-2',
        text: 'Find parent',
        confidence: 0.85,
        ambiguity: false,
        context: {},
        goal: 'Parent Search'
      });

      assert.strictEqual(result1.clarificationNeeded, true);
      assert.ok(result1.clarification);
      assert.strictEqual(result1.clarification.type, 'guided');
      assert.strictEqual(result1.clarification.currentStep, 'runningStyle');
      assert.strictEqual(result1.clarification.question, 'Which running style are you looking for?');
      assert.deepStrictEqual(result1.clarification.options, [
        'Front Runner',
        'Pace Chaser',
        'Late Surger',
        'End Closer'
      ]);

      // Answer step 1
      clarificationEngine.handleResponse('session-2', 'Front Runner');

      // Step 2: Next evaluation should request 'distance'
      const result2 = clarificationEngine.evaluate({
        sessionId: 'session-2',
        text: 'Find parent',
        confidence: 0.85,
        ambiguity: false,
        context: {},
        goal: 'Parent Search'
      });

      assert.strictEqual(result2.clarificationNeeded, true);
      assert.ok(result2.clarification);
      assert.strictEqual(result2.clarification.type, 'guided');
      assert.strictEqual(result2.clarification.currentStep, 'distance');
      assert.strictEqual(result2.clarification.question, 'What distance category?');
      assert.deepStrictEqual(result2.clarification.options, ['Sprint', 'Mile', 'Medium', 'Long']);

      // Answer step 2
      clarificationEngine.handleResponse('session-2', 'Mile');

      // Step 3: Next evaluation should request 'surface'
      const result3 = clarificationEngine.evaluate({
        sessionId: 'session-2',
        text: 'Find parent',
        confidence: 0.85,
        ambiguity: false,
        context: {},
        goal: 'Parent Search'
      });

      assert.strictEqual(result3.clarificationNeeded, true);
      assert.ok(result3.clarification);
      assert.strictEqual(result3.clarification.type, 'guided');
      assert.strictEqual(result3.clarification.currentStep, 'surface');
      assert.strictEqual(result3.clarification.question, 'What surface?');
      assert.deepStrictEqual(result3.clarification.options, ['Turf', 'Dirt']);

      // Answer step 3
      clarificationEngine.handleResponse('session-2', 'Turf');

      // Step 4: Final evaluation - should succeed without clarification needed!
      const resultFinal = clarificationEngine.evaluate({
        sessionId: 'session-2',
        text: 'Find parent',
        confidence: 0.95,
        ambiguity: false,
        context: {},
        goal: 'Parent Search'
      });

      assert.strictEqual(resultFinal.clarificationNeeded, false);
      const memoryState = clarificationEngine.getMemory().get('session-2');
      assert.ok(memoryState);
      assert.strictEqual(memoryState.data?.runningStyle, 'Front Runner');
      assert.strictEqual(memoryState.data?.distance, 'Mile');
      assert.strictEqual(memoryState.data?.surface, 'Turf');
    });

    await tSub.test('F7.5C — Top Match Clarification', () => {
      const result = clarificationEngine.evaluate({
        sessionId: 'session-3',
        text: 'Build Rudolf.',
        confidence: 0.95,
        ambiguity: false,
        context: {}
      });

      assert.strictEqual(result.clarificationNeeded, true);
      assert.ok(result.clarification);
      assert.strictEqual(result.clarification.type, 'top_match');
      assert.strictEqual(result.clarification.reason, 'ambiguous_entity');
      assert.strictEqual(result.clarification.question, 'I found multiple possible matches. Which one are you referring to?');
      assert.deepStrictEqual(result.clarification.options, [
        'Symboli Rudolf',
        'Rudolf Support Card',
        'Rudolf Event'
      ]);
    });

    await tSub.test('Tool Protection Policy', () => {
      const result = clarificationEngine.evaluate({
        sessionId: 'session-4',
        text: 'Need speed parent.',
        confidence: 0.95,
        ambiguity: true,
        context: {}
      });

      const executeTool = (clarificationResult: any) => {
        if (clarificationResult.clarificationNeeded) {
          return 'BLOCKED: Clarification active';
        }
        return 'EXECUTING TOOL';
      };

      assert.strictEqual(executeTool(result), 'BLOCKED: Clarification active');
    });
  });
});
