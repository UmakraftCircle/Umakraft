import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  sharedUserMemoryStore,
  formatUserId,
  extractRawUserId,
  type MemoryExtractionResult,
} from '@ai-agent-platform/integrations';
import { generateChatResponse } from '../../apps/discord/src/chat.js';
import { generateAskResponse } from '../../apps/discord/src/ask.js';
import { handleDirectMessage } from '../../apps/discord/src/dm.js';

describe('Phase 4: Shared User Memory & Personalized DM Experience', () => {
  const originalFetch = globalThis.fetch;
  const originalAiProvider = process.env['AI_PROVIDER'];
  const originalOpenAiKey = process.env['OPENAI_API_KEY'];

  beforeEach(() => {
    process.env['AI_PROVIDER'] = 'openai';
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    sharedUserMemoryStore.clearForTesting();
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
  });

  describe('1. User Profile Storage & Normalization', () => {
    it('normalizes user IDs correctly', () => {
      assert.equal(formatUserId('123456'), 'discord:123456');
      assert.equal(formatUserId('discord:123456'), 'discord:123456');
      assert.equal(extractRawUserId('discord:123456'), '123456');
      assert.equal(extractRawUserId('123456'), '123456');
    });

    it('creates default profile and updates fields seamlessly', async () => {
      const userId = 'user_abc';
      const prof = await sharedUserMemoryStore.getProfile(userId);
      assert.equal(prof.userId, 'discord:user_abc');
      assert.equal(prof.rawUserId, 'user_abc');
      assert.equal(prof.preferredName, null);
      assert.deepEqual(prof.projects, []);

      const updated = await sharedUserMemoryStore.updateProfile(userId, {
        preferredName: 'Alex',
        timezone: 'Asia/Manila',
        projects: ['Discord AI Bot', 'Umakraft Circle Tracker'],
        preferences: ['Concise answers', 'TypeScript first'],
        goals: ['Reach A+ rank in Champions Meeting'],
        interests: ['Machine Learning', 'Uma Musume'],
      });

      assert.equal(updated.preferredName, 'Alex');
      assert.equal(updated.timezone, 'Asia/Manila');
      assert.equal(updated.projects.length, 2);
      assert.equal(updated.preferences.length, 2);
      assert.equal(updated.goals.length, 1);
      assert.equal(updated.interests.length, 2);

      // Verify cached get
      const retrieved = await sharedUserMemoryStore.getProfile(userId);
      assert.equal(retrieved.preferredName, 'Alex');
      assert.equal(retrieved.timezone, 'Asia/Manila');
      assert.deepEqual(retrieved.projects, ['Discord AI Bot', 'Umakraft Circle Tracker']);
    });
  });

  describe('2. Memory Importance Scoring & Extraction Strategy', () => {
    it('ignores casual chatter and short acknowledgments', () => {
      const casuals = ['hi', 'hello', 'thanks', 'thank you', 'lol', 'k', 'cool', 'nice', 'bye', 'good morning', 'sure'];
      for (const phrase of casuals) {
        const res = sharedUserMemoryStore.scoreAndExtractMemory(phrase);
        assert.equal(res.save, false, `Expected "${phrase}" to be ignored`);
        assert.ok(res.importance <= 0.2);
      }
    });

    it('ignores inquiry questions asking for known memory', () => {
      const inquiries = [
        "What's my project?",
        "Who am I?",
        "Do you remember my favorite language?",
        "Tell me about my goals",
      ];
      for (const q of inquiries) {
        const res = sharedUserMemoryStore.scoreAndExtractMemory(q);
        assert.equal(res.save, false, `Expected inquiry "${q}" not to save a fact`);
      }
    });

    it('extracts user name and updates profile updates', () => {
      const res = sharedUserMemoryStore.scoreAndExtractMemory('My name is Alex');
      assert.equal(res.save, true);
      assert.equal(res.category, 'identity');
      assert.equal(res.profileUpdates?.preferredName, 'Alex');
      assert.ok(res.importance >= 0.9);
    });

    it('extracts timezone correctly', () => {
      const res = sharedUserMemoryStore.scoreAndExtractMemory('My timezone is Asia/Manila');
      assert.equal(res.save, true);
      assert.equal(res.category, 'identity');
      assert.equal(res.profileUpdates?.timezone, 'Asia/Manila');
    });

    it('extracts projects correctly', () => {
      const res = sharedUserMemoryStore.scoreAndExtractMemory("I'm building a Discord AI assistant");
      assert.equal(res.save, true);
      assert.equal(res.category, 'project');
      assert.ok(res.profileUpdates?.projects?.includes('Discord AI assistant'));
      assert.ok(res.fact?.includes('Discord AI assistant'));
    });

    it('extracts favorite language and preferences', () => {
      const res = sharedUserMemoryStore.scoreAndExtractMemory('My favorite language is TypeScript');
      assert.equal(res.save, true);
      assert.equal(res.category, 'preference');
      assert.ok(res.fact?.includes('TypeScript'));
    });

    it('extracts interests and goals', () => {
      const interestRes = sharedUserMemoryStore.scoreAndExtractMemory("I'm interested in Discord bots and AI");
      assert.equal(interestRes.save, true);
      assert.equal(interestRes.category, 'interest');

      const goalRes = sharedUserMemoryStore.scoreAndExtractMemory('My goal is to finish the Discord bot');
      assert.equal(goalRes.save, true);
      assert.equal(goalRes.category, 'goal');
    });
  });

  describe('3. Memory Persistence & Context Injection', () => {
    it('persists and retrieves memories with confidence thresholds', async () => {
      const userId = 'trainer_456';
      await sharedUserMemoryStore.addMemory(userId, {
        userId,
        category: 'project',
        fact: 'User is building a Discord AI assistant',
        importance: 0.9,
      });
      await sharedUserMemoryStore.addMemory(userId, {
        userId,
        category: 'preference',
        fact: 'User prefers dark mode responses',
        importance: 0.8,
      });
      await sharedUserMemoryStore.addMemory(userId, {
        userId,
        category: 'fact',
        fact: 'User mentioned coffee once',
        importance: 0.2,
      });

      const highImportance = await sharedUserMemoryStore.getMemories(userId, { minImportance: 0.5 });
      assert.equal(highImportance.length, 2);
      assert.ok(highImportance.some((m) => m.fact.includes('Discord AI assistant')));
      assert.ok(highImportance.some((m) => m.fact.includes('dark mode')));

      const all = await sharedUserMemoryStore.getMemories(userId, { minImportance: 0.0 });
      assert.equal(all.length, 3);
    });

    it('generates a formatted systemPromptInjection for LLM agents', async () => {
      const userId = 'trainer_789';
      await sharedUserMemoryStore.updateProfile(userId, {
        preferredName: 'Jordan',
        timezone: 'UTC+8',
        projects: ['Discord AI Assistant'],
        preferences: ['TypeScript code examples'],
      });
      await sharedUserMemoryStore.addMemory(userId, {
        userId,
        category: 'project',
        fact: 'User is building a Discord AI assistant',
        importance: 0.9,
      });

      const context = await sharedUserMemoryStore.retrieveMemoryContext(userId, 'dm:trainer_789');
      assert.equal(context.profile.preferredName, 'Jordan');
      assert.ok(context.systemPromptInjection.includes('Preferred Name: Jordan'));
      assert.ok(context.systemPromptInjection.includes('Timezone: UTC+8'));
      assert.ok(context.systemPromptInjection.includes('Discord AI Assistant'));
      assert.ok(context.systemPromptInjection.includes('User is building a Discord AI assistant'));
    });
  });

  describe('4. Shared Memory Across /ask and /chat in DMs', () => {
    it('shares memory saved in /chat with /ask queries', async () => {
      const userId = 'dm_trainer_1';
      const channelId = 'discord-dm:dm_trainer_1';

      // Mock LLM fetch responses
      globalThis.fetch = async (url: any, opts: any) => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Understood, Trainer! I noted your project and preferred name.' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      // 1. User tells chat: "My name is Morgan and I'm building a Discord AI assistant"
      const chatReply = await generateChatResponse({
        userId,
        channelId,
        message: "My name is Morgan and I'm building a Discord AI assistant",
      });
      assert.ok(chatReply);

      // Verify SharedUserMemory was updated from /chat
      const profile = await sharedUserMemoryStore.getProfile(userId);
      assert.equal(profile.preferredName, 'Morgan');
      assert.ok(profile.projects.includes('Discord AI assistant'));

      const memories = await sharedUserMemoryStore.getMemories(userId);
      assert.ok(memories.some((m) => m.fact.includes('Morgan') || m.fact.includes('Discord AI assistant')));

      // 2. User asks /ask a question in DM: memory context is retrieved and shared
      const askMemoryContext = await sharedUserMemoryStore.retrieveMemoryContext(userId, channelId);
      assert.equal(askMemoryContext.profile.preferredName, 'Morgan');
      assert.ok(askMemoryContext.systemPromptInjection.includes('Preferred Name: Morgan'));
      assert.ok(askMemoryContext.systemPromptInjection.includes('Discord AI assistant'));
    });

    it('updates conversation summary over multi-turn DM dialogue', async () => {
      const userId = 'dm_trainer_summary';
      const channelId = 'discord-dm:dm_trainer_summary';

      await sharedUserMemoryStore.updateProfile(userId, {
        preferredName: 'Sam',
        projects: ['AI Agent Platform'],
        goals: ['Complete Phase 4'],
      });

      const summary = await sharedUserMemoryStore.updateConversationSummary(userId, channelId);
      assert.ok(summary.summary.includes('Sam'));
      assert.ok(summary.summary.includes('AI Agent Platform'));
      assert.equal(summary.turnCount, 1);

      const summary2 = await sharedUserMemoryStore.updateConversationSummary(userId, channelId);
      assert.equal(summary2.turnCount, 2);
    });
  });

  describe('5. Slash Commands & DM Router Compatibility', () => {
    it('executes handleDirectMessage with shared memory without throwing', async () => {
      const userId = 'dm_routing_user';
      let sentReply = '';

      const mockMessage: any = {
        author: { id: userId, username: 'Tester', bot: false },
        content: 'My name is Robin',
        guild: null,
        guildId: null,
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => {
            sentReply = text;
          },
        },
      };

      await handleDirectMessage(mockMessage, {
        chatGenerator: async (opts) => {
          await sharedUserMemoryStore.extractAndSaveMemory(opts.userId, opts.message);
          return `Nice to meet you, Robin!`;
        },
      });

      assert.equal(sentReply, 'Nice to meet you, Robin!');
      const prof = await sharedUserMemoryStore.getProfile(userId);
      assert.equal(prof.preferredName, 'Robin');
    });
  });
});
