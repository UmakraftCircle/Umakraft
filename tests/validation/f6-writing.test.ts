import { test } from 'node:test';
import assert from 'node:assert';
import {
  GlossaryService,
  LanguageCoreService,
  WritingEngine
} from '../../packages/lily-ai/src/language-core/index.js';

test('F6 — Writing Intelligence Engine', async (t) => {
  const glossaryService = new GlossaryService();
  const writingEngine = new WritingEngine(glossaryService);
  const coreService = new LanguageCoreService();

  await t.test('F6.1 Sentence generation', () => {
    const builder = writingEngine.getSentenceBuilder();
    const sentence = builder.buildSentence({
      subject: 'Trainer',
      action: 'needs',
      value: '30M fans'
    });
    assert.strictEqual(sentence, 'Trainer needs 30 million fans.');
  });

  await t.test('F6.2 Paragraph generation', () => {
    const builder = writingEngine.getParagraphBuilder();
    const para = builder.buildParagraph([
      'Oguri Cap needs speed training.',
      'Trainer needs more fans.',
      'The next race is Arima Kinen.'
    ]);
    
    // Check that sentences are combined with logical transition words
    assert.ok(para.includes('Additionally, Trainer needs more fans.'));
    assert.ok(para.includes('Furthermore, the next race is Arima Kinen.'));
  });

  await t.test('F6.3 Style selection', () => {
    const result1 = writingEngine.generate({
      topic: 'Fan Requirement',
      facts: [
        { subject: 'Trainer', attribute: 'Fans', value: 120000000 },
        { subject: 'Trainer', attribute: 'Required Fans', value: 150000000 }
      ],
      entities: [],
      audience: 'Trainer',
      style: 'Warning',
      tone: 'Friendly'
    });
    assert.ok(result1.text.startsWith('⚠️ WARNING:'));
  });

  await t.test('F6.4 Tone selection & Personality Integration', () => {
    const resultFriendly = writingEngine.generate({
      topic: 'Fan Requirement',
      facts: [
        { subject: 'Trainer', attribute: 'Fans', value: 120000000 },
        { subject: 'Trainer', attribute: 'Required Fans', value: 150000000 }
      ],
      entities: [],
      audience: 'Trainer',
      style: 'Conversation',
      tone: 'Friendly'
    });
    
    assert.ok(resultFriendly.text.includes('Hi Trainer!') || resultFriendly.text.includes('Trainer, you\'re getting close!'));
    assert.ok(resultFriendly.text.includes('amazing'));

    const resultCoach = writingEngine.generate({
      topic: 'Fan Requirement',
      facts: [
        { subject: 'Trainer', attribute: 'Fans', value: 120000000 },
        { subject: 'Trainer', attribute: 'Required Fans', value: 150000000 }
      ],
      entities: [],
      audience: 'Trainer',
      style: 'Conversation',
      tone: 'Coach'
    });
    assert.ok(resultCoach.text.toLowerCase().includes('focus'));
  });

  await t.test('F6.5 Formatting', () => {
    const formatter = writingEngine.getFormatter();
    const formattedList = formatter.list(['Speed', 'Stamina']);
    assert.strictEqual(formattedList, '• Speed\n• Stamina');

    const formattedTable = formatter.table(['Stat', 'Value'], [['Speed', '1200'], ['Stamina', '800']]);
    assert.ok(formattedTable.includes('Stat'));
    assert.ok(formattedTable.includes('Speed'));
    assert.ok(formattedTable.includes('1200'));
  });

  await t.test('F6.6 Explanation generation', () => {
    const explEngine = writingEngine.getExplanationEngine();
    const explanation = explEngine.explain('Front Runner');
    assert.ok(explanation.toLowerCase().includes('lead'));
  });

  await t.test('F6.7 Summarization', () => {
    const summarizer = writingEngine.getSummarizer();
    const sampleText = 'Speed is critical. Stamina is for distance. Power is for acceleration. Wit is for skills.';
    
    const shortSum = summarizer.summarize(sampleText, 'short');
    assert.strictEqual(shortSum, 'Speed is critical.');

    const medSum = summarizer.summarize(sampleText, 'medium');
    assert.strictEqual(medSum, 'Speed is critical. Stamina is for distance.');
  });

  await t.test('F6.8 Writing engine output validation', () => {
    const context = {
      topic: 'Fan Requirement',
      facts: [
        { subject: 'Trainer', attribute: 'Fans', value: 120000000 },
        { subject: 'Trainer', attribute: 'Required Fans', value: 150000000 }
      ],
      entities: [],
      audience: 'Trainer',
      style: 'Conversation',
      tone: 'Friendly'
    };

    const res = writingEngine.generate(context);
    assert.ok(res.text.length > 10);
    assert.strictEqual(res.style, 'Conversation');
    assert.strictEqual(res.tone, 'Friendly');
  });

  await t.test('F6.9 LanguageCore integration', async () => {
    const analysis = await coreService.analyze('Current Fans: 120M. Required Fans: 150M.');
    assert.ok(analysis.writing);
    assert.strictEqual(analysis.writing.style, 'Conversation');
    assert.ok(analysis.writing.text.toLowerCase().includes('fans'));
  });
});
