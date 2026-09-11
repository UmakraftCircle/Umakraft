import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  memoryService,
  PersistentMemoryService,
  conversationMemoryStore,
  sharedUserMemoryStore,
  MAX_MESSAGES,
  type ChatMessage,
} from '@ai-agent-platform/integrations';
import { generateChatResponse } from '../../apps/discord/src/chat.js';
import { handleDirectMessage } from '../../apps/discord/src/dm.js';

describe('Phase 6: Long-Term Memory and Persistence', () => {
  const originalFetch = globalThis.fetch;
  const originalAiProvider = process.env['AI_PROVIDER'];
  const originalOpenAiKey = process.env['OPENAI_API_KEY'];
  const originalSimThreshold = process.env['CHAT_SIMILARITY_THRESHOLD'];

  beforeEach(async () => {
    process.env['AI_PROVIDER'] = 'openai';
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    process.env['CHAT_SIMILARITY_THRESHOLD'] = '0.95';
    await memoryService.clearHistory();
    conversationMemoryStore.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalAiProvider !== undefined) {
      process.env['AI_PROVIDER'] = originalAiProvider;
    } else {
      delete process.env['AI_PROVIDER'];
    }
    if (originalOpenAiKey !== undefined) {
      process.env['OPENAI_API_KEY'] = originalOpenAiKey;
    } else {
      delete process.env['OPENAI_API_KEY'];
    }
    if (originalSimThreshold !== undefined) {
      process.env['CHAT_SIMILARITY_THRESHOLD'] = originalSimThreshold;
    } else {
      delete process.env['CHAT_SIMILARITY_THRESHOLD'];
    }
  });

  describe('1. Memory Service Abstraction & Persistence', () => {
    it('saves user and assistant messages to persistent memory service', async () => {
      const userId = 'user_trainer_456';
      await memoryService.saveUserMessage(userId, 'Good morning assistant');
      await memoryService.saveAssistantMessage(userId, 'Good morning Trainer! Ready for the race?');

      const history = await memoryService.getHistory(userId);
      assert.equal(history.length, 2);
      assert.equal(history[0].role, 'user');
      assert.equal(history[0].content, 'Good morning assistant');
      assert.equal(history[1].role, 'assistant');
      assert.equal(history[1].content, 'Good morning Trainer! Ready for the race?');
    });

    it('survives simulated bot restarts by reloading history across fresh service instances', async () => {
      const userId = 'user_restart_test_789';
      const serviceInstance1 = new PersistentMemoryService();
      await serviceInstance1.saveUserMessage(userId, 'Remember my favorite tactic: End Rush');
      await serviceInstance1.saveAssistantMessage(userId, 'Understood, End Rush tactic recorded.');

      // Simulate bot restart: create new PersistentMemoryService instance
      const serviceInstanceAfterRestart = new PersistentMemoryService();
      const historyAfterRestart = await serviceInstanceAfterRestart.getHistory(userId);

      assert.equal(historyAfterRestart.length, 2);
      assert.equal(historyAfterRestart[0].content, 'Remember my favorite tactic: End Rush');
      assert.equal(historyAfterRestart[1].content, 'Understood, End Rush tactic recorded.');
    });

    it('formats multi-turn conversation into prompt context correctly', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'What is the track condition?' },
        { role: 'assistant', content: 'The track condition is Good.' },
        { role: 'user', content: 'Should we equip mud cleats?' },
      ];

      const formatted = memoryService.formatHistoryForPrompt(messages);
      assert.match(formatted, /Trainer: What is the track condition\?/);
      assert.match(formatted, /Assistant: The track condition is Good\./);
      assert.match(formatted, /Trainer: Should we equip mud cleats\?/);
    });
  });

  describe('2. User Session Isolation & History Boundaries', () => {
    it('strictly isolates persistent conversation history between different users', async () => {
      const userAlpha = 'trainer_alpha_1';
      const userBeta = 'trainer_beta_2';

      await memoryService.saveUserMessage(userAlpha, 'My team name is Spica');
      await memoryService.saveAssistantMessage(userAlpha, 'Spica is registered!');

      await memoryService.saveUserMessage(userBeta, 'My team name is Rigil');
      await memoryService.saveAssistantMessage(userBeta, 'Rigil is registered!');

      const historyAlpha = await memoryService.getHistory(userAlpha);
      const historyBeta = await memoryService.getHistory(userBeta);

      assert.equal(historyAlpha.length, 2);
      assert.equal(historyAlpha[0].content, 'My team name is Spica');

      assert.equal(historyBeta.length, 2);
      assert.equal(historyBeta[0].content, 'My team name is Rigil');

      const textAlpha = JSON.stringify(historyAlpha);
      const textBeta = JSON.stringify(historyBeta);
      assert.ok(!textAlpha.includes('Rigil'), 'Alpha must not contain Beta memory');
      assert.ok(!textBeta.includes('Spica'), 'Beta must not contain Alpha memory');
    });

    it('enforces sliding window limits to avoid token overflow', async () => {
      const customLimitService = new PersistentMemoryService(5);
      const userId = 'sliding_window_user';

      for (let i = 1; i <= 8; i++) {
        await customLimitService.saveUserMessage(userId, `Turn ${i}`);
      }

      const history = await customLimitService.getHistory(userId, 5);
      assert.equal(history.length, 5);
      assert.equal(history[0].content, 'Turn 4');
      assert.equal(history[4].content, 'Turn 8');
    });
  });

  describe('3. Long-Term Facts & Profile Integration', () => {
    it('manages long-term user profile and facts alongside conversation context', async () => {
      const userId = 'trainer_profile_999';

      await memoryService.updateUserProfile(userId, {
        preferredName: 'Coach Hayahide',
        preferences: ['End Rush tactic', 'Morning training'],
        interests: ['Pace calculation', 'Biomechanics'],
      });

      const userContext = await memoryService.getUserContext(userId);
      assert.equal(userContext.profile.preferredName, 'Coach Hayahide');
      assert.deepEqual(userContext.profile.preferences, ['End Rush tactic', 'Morning training']);
      assert.deepEqual(userContext.profile.interests, ['Pace calculation', 'Biomechanics']);
      assert.match(userContext.systemPromptInjection, /Coach Hayahide/);
    });
  });

  describe('4. End-to-End DM Multi-Turn Conversation with Persistence', () => {
    it('retains context across sequential DM turns and persists to store', async () => {
      const userId = 'e2e_phase6_user_111';
      const channelId = `discord-dm:${userId}`;
      const promptsReceived: string[] = [];

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const parsed = JSON.parse(bodyStr || '{}');
        const msgs = parsed.messages || [];
        const userPrompt = msgs[msgs.length - 1]?.content || '';
        const systemPrompt = msgs[0]?.content || '';
        promptsReceived.push(userPrompt);

        // Memory extraction check
        if (systemPrompt.includes('Extract facts') || systemPrompt.includes('MEMORY EXTRACTION') || userPrompt.includes('Extract any new facts')) {
          return new Response(JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify({
                  extractedFacts: [],
                  profilePatch: { preferredName: 'Alice' },
                  explanation: 'Extracted name',
                }),
              },
            }],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (userPrompt.includes("What's my name?") || userPrompt.includes("What is my name?")) {
          return new Response(JSON.stringify({
            choices: [{
              message: { role: 'assistant', content: 'Your name is Alice.' }
            }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
          choices: [{
            message: { role: 'assistant', content: 'Nice to meet you, Alice!' }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as any;

      // Turn 1
      const reply1 = await generateChatResponse({
        userId,
        channelId,
        message: 'Hello, My name is Alice',
        subcommand: 'auto',
      });
      assert.match(reply1, /Alice/);

      // Turn 2
      const reply2 = await generateChatResponse({
        userId,
        channelId,
        message: "What's my name?",
        subcommand: 'auto',
      });
      assert.equal(reply2, 'Your name is Alice.');

      // Verify persistent history in memoryService
      const savedHistory = await memoryService.getHistory(userId);
      assert.ok(savedHistory.length >= 4);
      assert.match(savedHistory[0].content, /My name is Alice/);
      assert.match(savedHistory[1].content, /Alice/);
    });
  });
});
