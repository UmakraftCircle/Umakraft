import { test } from 'node:test';
import assert from 'node:assert';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/services/knowledge/lily-knowledge-service.js';
import { KnowledgeSource, ConfidenceLevel } from '../../packages/lily-ai/src/services/knowledge/knowledge-analysis.js';

test('C5 — Hallucination Audit', async (t) => {
  const knowledgeService = new LilyKnowledgeService();

  const runTest = (message: string, intent: string, expectedSource: KnowledgeSource, expectedConfidence: ConfidenceLevel) => {
    const analysis = knowledgeService.analyze({ normalizedMessage: message, intent, taxonomyMatches: [], confidence: 1.0, entities: [] } as any);
    assert.strictEqual(analysis.evidence.source, expectedSource, `Source mismatch for "${message}"`);
    assert.strictEqual(analysis.evidence.confidence, expectedConfidence, `Confidence mismatch for "${message}"`);
  };

  await t.test('C5.1 Handbook Hallucination', () => runTest("What is the 500M mandatory fan rule?", 'fan_requirements', KnowledgeSource.HANDBOOK, ConfidenceLevel.MEDIUM));
  await t.test('C5.2 Taxonomy Skill Hallucination', () => runTest("What does Super Galaxy Turbo do?", 'unknown', KnowledgeSource.NONE, ConfidenceLevel.LOW));
  await t.test('C5.3 Character Hallucination', () => runTest("Best build for Ultra Teio", 'unknown', KnowledgeSource.NONE, ConfidenceLevel.LOW));
  await t.test('C5.4 Track Hallucination', () => runTest("Best parent for Moonlight Raceway", 'unknown', KnowledgeSource.NONE, ConfidenceLevel.LOW));
  await t.test('C5.6 Trainer Hallucination', () => runTest("Show my profile", 'trainer_profile', KnowledgeSource.DATABASE, ConfidenceLevel.HIGH));
  await t.test('C5.8 Handbook Authority', () => {
    const analysis = knowledgeService.analyze({ normalizedMessage: "What is the minimum fan requirement?", intent: 'fan_requirements', taxonomyMatches: [], confidence: 1.0, entities: [] } as any);
    assert.strictEqual(analysis.evidence.source, KnowledgeSource.HANDBOOK);
    assert.ok(analysis.evidence.confidence === ConfidenceLevel.MEDIUM || analysis.evidence.confidence === ConfidenceLevel.HIGH);
  });
  await t.test('C5.10 Future Knowledge', () => runTest("What will Umamusume add next year?", 'unknown', KnowledgeSource.NONE, ConfidenceLevel.LOW));
});
