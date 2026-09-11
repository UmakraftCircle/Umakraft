import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { knowledgeManager, knowledgeRouter, KnowledgeDomain } from '../../apps/discord/src/knowledge/knowledge-system.ts';

describe('H5 — Knowledge System & Domain Isolation Tests', () => {
  it('1. Routes handbook questions to HANDBOOK domain', () => {
    const domain = knowledgeRouter.route('What is the monthly fan requirement?');
    assert.equal(domain, KnowledgeDomain.HANDBOOK);
  });

  it('2. Routes character queries to UMA_GUIDE domain', () => {
    const domain = knowledgeRouter.route('Tell me about Yamanin Zephyr');
    assert.equal(domain, KnowledgeDomain.UMA_GUIDE);
  });

  it('3. Routes general chat queries to GENERAL_CHAT domain with no retrieval', () => {
    const domain = knowledgeRouter.route('How are you today?');
    assert.equal(domain, KnowledgeDomain.GENERAL_CHAT);

    const snippets = knowledgeManager.queryKnowledge('How are you today?');
    assert.equal(snippets.length, 0);
  });

  it('4. Retrieves isolated Uma knowledge without club contamination', () => {
    const snippets = knowledgeManager.queryKnowledge('Tell me about Yamanin Zephyr');
    assert.ok(snippets.length > 0);
    assert.equal(snippets[0].domain, KnowledgeDomain.UMA_GUIDE);
    assert.ok(snippets[0].content.includes('Yamanin Zephyr'));
  });
});
