import { test } from 'node:test';
import assert from 'node:assert';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/services/knowledge/lily-knowledge-service.js';
import { KnowledgeSource } from '../../packages/lily-ai/src/services/knowledge/knowledge-analysis.js';

test('D1 — Uma Knowledge Integration', async (t) => {
  const knowledgeService = new LilyKnowledgeService();

  const runTest = (intent: string, expectedSource: KnowledgeSource) => {
    const analysis = knowledgeService.analyze({ normalizedMessage: "query", intent, taxonomyMatches: [], confidence: 1.0, entities: [] } as any);
    assert.strictEqual(analysis.evidence.source, expectedSource, `Source mismatch for intent "${intent}"`);
  };

  await t.test('D1.1 Character Info Routing', () => runTest('character_info', KnowledgeSource.UMA_KNOWLEDGE));
  await t.test('D1.2 Skill Info Routing', () => runTest('skill_info', KnowledgeSource.UMA_KNOWLEDGE));
  await t.test('D1.3 Support Info Routing', () => runTest('support_info', KnowledgeSource.UMA_KNOWLEDGE));
  await t.test('D1.4 Race Info Routing', () => runTest('race_info', KnowledgeSource.UMA_KNOWLEDGE));
  await t.test('D1.5 Track Info Routing', () => runTest('track_info', KnowledgeSource.UMA_KNOWLEDGE));
});
