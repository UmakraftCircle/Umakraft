import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { LilyAI, createLilyAI } from '../../packages/lily-ai/src/core/lily-ai.js';
import { MemoryService } from '../../packages/lily-ai/src/services/memory/memory-service.js';
import { trainerLinkStore } from '../../packages/integrations/src/trainer-links.js';
import { linkRequestStore } from '../../packages/integrations/src/link-requests.js';
import { getTursoClient } from '../../packages/integrations/src/turso.js';

describe('B4 — Link Request Integration', () => {
  let lily: LilyAI;
  let memory: MemoryService;

  before(async () => {
    lily = createLilyAI();
    await trainerLinkStore.init();
    await linkRequestStore.init();
  });

  beforeEach(async () => {
    // Clear stores for clean tests
    const db = getTursoClient();
    await db.execute('DELETE FROM trainer_links');
    await db.execute('DELETE FROM link_requests');
  });

  describe('1. Intent Detection', () => {
    test('Detects "link my account" as link_request', () => {
      const res = lily.getOrchestrator().getLanguageService().analyze('link my account');
      assert.strictEqual(res.intent, 'link_request');
    });

    test('Detects "i want to connect my trainer account" as link_request', () => {
      const res = lily.getOrchestrator().getLanguageService().analyze('i want to connect my trainer account');
      assert.strictEqual(res.intent, 'link_request');
    });

    test('Detects "is my link approved?" as link_status', () => {
      const res = lily.getOrchestrator().getLanguageService().analyze('is my link approved?');
      assert.strictEqual(res.intent, 'link_status');
    });

    test('Detects "check my request status" as link_status', () => {
      const res = lily.getOrchestrator().getLanguageService().analyze('check my request status');
      assert.strictEqual(res.intent, 'link_status');
    });

    test('Detects "how do i link?" as link_help', () => {
      const res = lily.getOrchestrator().getLanguageService().analyze('how do i link?');
      assert.strictEqual(res.intent, 'link_help');
    });
  });

  describe('2. Multi-step Link Workflow', () => {
    test('Starts link request and asks for missing Trainer ID/Name', async () => {
      const res = await lily.chat({
        userId: 'user-new',
        username: 'NewUser',
        message: 'link my account'
      });

      if (!res.response.includes("I'd be happy to help you link your account")) {
        console.log('Actual response:', res.response);
      }
      assert.ok(res.response.includes("I'd be happy to help you link your account"));
      assert.ok(res.response.includes('Trainer ID and Trainer Name'));
    });

    test('Completes link request once ID and Name are provided', async () => {
      // 1. Start request
      await lily.chat({
        userId: 'user-flow',
        username: 'FlowUser',
        message: 'link my account'
      });

      // 2. Provide Trainer ID
      await lily.chat({
        userId: 'user-flow',
        username: 'FlowUser',
        message: 'my ID is 123456'
      });

      // 3. Provide Trainer Name (completes request)
      const res = await lily.chat({
        userId: 'user-flow',
        username: 'FlowUser',
        message: 'my trainer name is FlowTrainer'
      });

      if (!res.response.includes('submitted successfully')) {
        console.log('Completes response:', res.response);
      }
      assert.ok(res.response.includes('submitted successfully'));
      assert.ok(res.response.includes('Pending Approval'));

      // Verify in DB
      const req = await linkRequestStore.getPendingOrForwarded('user-flow');
      assert.strictEqual(req?.trainerId, '123456');
      assert.strictEqual(req?.trainerName, 'FlowTrainer');
    });
  });

  describe('3. Link Status Tracking', () => {
    test('Shows pending status for unapproved requests', async () => {
      await linkRequestStore.create({
        discordUserId: 'user-pending',
        discordUsername: 'PendingUser',
        trainerId: '999888',
        trainerName: 'WaitForMe'
      });

      const res = await lily.chat({
        userId: 'user-pending',
        message: 'is my link approved?'
      });

      if (!res.response.includes('still pending review')) {
        console.log('Pending status response:', res.response);
      }
      assert.ok(res.response.includes('still pending review'));
    });

    test('Shows already linked for approved/linked accounts', async () => {
      await trainerLinkStore.upsert({
        discordUserId: 'user-linked',
        trainerId: '111222',
        trainerName: 'AlreadyLinked',
        linkedAt: new Date().toISOString()
      });

      const res = await lily.chat({
        userId: 'user-linked',
        message: 'what is my link status?'
      });

      if (!res.response.includes('already linked')) {
        console.log('Linked status response:', res.response);
      }
      assert.ok(res.response.includes('already linked'));
      assert.ok(res.response.includes('111222'));
    });

    test('Shows link help for users with no request', async () => {
      const res = await lily.chat({
        userId: 'user-none',
        message: 'what is my link status?'
      });

      assert.ok(res.response.includes("don't have an active link request"));
      assert.ok(res.response.includes('Would you like me to start one'));
    });
  });

  describe('4. Knowledge Rules Enforcement', () => {
    test('Link query classifies to domain: account_linking and source: database', async () => {
      const knowledgeService = lily.getOrchestrator().getKnowledgeService();
      const languageService = lily.getOrchestrator().getLanguageService();
      const res = knowledgeService.analyze(languageService.analyze('link my account'));
      assert.strictEqual(res.domain, 'account_linking');
      assert.strictEqual(res.source, 'database');
    });

    test('Strict rule enforcement: database allowed, handbook/taxonomy/web_search strictly forbidden', async () => {
      const knowledgeService = lily.getOrchestrator().getKnowledgeService() as any;
      assert.strictEqual(knowledgeService.isSourceAllowedForLink('database'), true);
      assert.strictEqual(knowledgeService.isSourceAllowedForLink('handbook'), false);
      assert.strictEqual(knowledgeService.isSourceAllowedForLink('web_search'), false);
    });
  });
});
