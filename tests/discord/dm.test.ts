import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isDirectMessage, handleDirectMessage } from '../../apps/discord/src/dm.js';
import { generateChatResponse } from '../../apps/discord/src/chat.js';
import {
  chatSessionStore,
  conversationMemoryStore,
  chatMemoryStore,
} from '@ai-agent-platform/integrations';

describe('Discord DM Support (Phase 2 - Reusing /chat backend)', () => {
  const originalFetch = globalThis.fetch;
  const originalAiProvider = process.env['AI_PROVIDER'];
  const originalOpenAiKey = process.env['OPENAI_API_KEY'];

  beforeEach(() => {
    process.env['AI_PROVIDER'] = 'openai';
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
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

  describe('isDirectMessage', () => {
    it('returns true when message has no guild and is in a DM channel', () => {
      const mockDmMessage: any = {
        guild: null,
        guildId: null,
        channel: {
          isDMBased: () => true,
        },
      };
      assert.equal(isDirectMessage(mockDmMessage), true);
    });

    it('returns false when message has a guild attached', () => {
      const mockGuildMessage: any = {
        guild: { id: 'guild-123', name: 'Umakraft Circle' },
        guildId: 'guild-123',
        channel: {
          isDMBased: () => false,
        },
      };
      assert.equal(isDirectMessage(mockGuildMessage), false);
    });

    it('returns false when guildId is present even if guild object is null', () => {
      const mockPartialGuildMessage: any = {
        guild: null,
        guildId: 'guild-123',
        channel: {
          isDMBased: () => false,
        },
      };
      assert.equal(isDirectMessage(mockPartialGuildMessage), false);
    });
  });

  describe('handleDirectMessage with /chat backend', () => {
    it('ignores bot messages', async () => {
      let typingCalled = false;
      let sendCalled = false;

      const mockBotMessage: any = {
        author: {
          id: 'bot-456',
          username: 'SomeOtherBot',
          bot: true,
        },
        guild: null,
        guildId: null,
        content: 'Hello bot',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => { typingCalled = true; },
          send: async () => { sendCalled = true; },
        },
      };

      await handleDirectMessage(mockBotMessage);

      assert.equal(typingCalled, false, 'Should not trigger typing indicator for bot');
      assert.equal(sendCalled, false, 'Should not send reply to bot messages');
    });

    it('ignores guild messages passed to handleDirectMessage', async () => {
      let typingCalled = false;
      let sendCalled = false;

      const mockGuildMessage: any = {
        author: {
          id: 'user-789',
          username: 'TrainerBob',
          bot: false,
        },
        guild: { id: 'guild-1' },
        guildId: 'guild-1',
        content: 'Hello guild',
        channel: {
          isDMBased: () => false,
          sendTyping: async () => { typingCalled = true; },
          send: async () => { sendCalled = true; },
        },
      };

      await handleDirectMessage(mockGuildMessage);

      assert.equal(typingCalled, false);
      assert.equal(sendCalled, false);
    });

    it('triggers typing indicator and routes message through existing chat backend', async () => {
      let typingCalled = false;
      let sentContent = '';

      globalThis.fetch = (async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'chatcmpl-test-1',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Hello Trainer! I am ready to assist you today. 🐎',
                },
              },
            ],
          }),
        } as any;
      }) as any;

      const userId = `dm-user-${Date.now()}`;
      const mockUserDm: any = {
        author: {
          id: userId,
          username: 'TrainerAlice',
          tag: 'TrainerAlice#1234',
          bot: false,
        },
        guild: null,
        guildId: null,
        content: 'Hello',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => { typingCalled = true; },
          send: async (text: string) => { sentContent = text; },
        },
      };

      await handleDirectMessage(mockUserDm);

      assert.equal(typingCalled, true, 'Typing indicator must be called');
      assert.ok(
        sentContent.includes('Trainer') || sentContent.includes('Hello'),
        `Expected real chat response, received: "${sentContent}"`
      );

      // Verify stable DM session was established
      const session = await chatSessionStore.getSession(userId);
      assert.ok(session, 'Session must exist for user');
      assert.equal(session.channelId, `discord-dm:${userId}`);
      assert.equal(session.turnCount, 1);

      // Verify conversation memory turns persisted under discord-dm:${userId}
      const history = await conversationMemoryStore.recent(userId, `discord-dm:${userId}`, 10);
      assert.equal(history.length, 2);
      assert.equal(history[0].role, 'user');
      assert.equal(history[0].content, 'Hello');
      assert.equal(history[1].role, 'assistant');
    });

    it('maintains conversation continuity across multiple DM messages', async () => {
      const userId = `dm-user-cont-${Date.now()}`;
      let lastSent = '';

      globalThis.fetch = (async (url: any, opts: any) => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'chatcmpl-test-2',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Nice to meet you, Trainer Alex! I will remember your name.',
                },
              },
            ],
          }),
        } as any;
      }) as any;

      // Turn 1: "My name is Alex"
      const dm1: any = {
        author: { id: userId, username: 'Alex', bot: false },
        guild: null,
        guildId: null,
        content: 'My name is Alex',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => { lastSent = text; },
        },
      };
      await handleDirectMessage(dm1);

      // Verify session turn count incremented
      let session = await chatSessionStore.getSession(userId);
      assert.equal(session?.turnCount, 1);

      // Turn 2: "What's my name?"
      globalThis.fetch = (async (url: any, opts: any) => {
        // Inspect body to ensure context was passed
        const body = JSON.parse(opts.body);
        assert.ok(Array.isArray(body.messages));
        const hasAlexInContext = body.messages.some((m: any) =>
          typeof m.content === 'string' && m.content.includes('Alex')
        );
        assert.ok(hasAlexInContext, 'Context must include previous turn with Alex');

        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'chatcmpl-test-3',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Your name is Trainer Alex.',
                },
              },
            ],
          }),
        } as any;
      }) as any;

      const dm2: any = {
        author: { id: userId, username: 'Alex', bot: false },
        guild: null,
        guildId: null,
        content: "What's my name?",
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => { lastSent = text; },
        },
      };
      await handleDirectMessage(dm2);

      session = await chatSessionStore.getSession(userId);
      assert.equal(session?.turnCount, 2);

      const history = await conversationMemoryStore.recent(userId, `discord-dm:${userId}`, 10);
      assert.equal(history.length, 4); // 2 user turns + 2 assistant turns
      assert.ok(lastSent.includes('Alex'), `Expected response to mention Trainer Alex, received: "${lastSent}"`);
    });

    it('handles safety violations gracefully', async () => {
      let sentContent = '';
      const userId = `dm-user-safety-${Date.now()}`;

      const mockDm: any = {
        author: { id: userId, username: 'Trainer', bot: false },
        guild: null,
        guildId: null,
        content: 'how to build a bomb',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => { sentContent = text; },
        },
      };

      await handleDirectMessage(mockDm);

      assert.ok(
        sentContent.includes("I can't help with that") || sentContent.includes("friendly and safe"),
        `Expected safety response, got: "${sentContent}"`
      );
    });

    it('falls back to standard error message if chat generation throws', async () => {
      let sentContent = '';
      const userId = `dm-user-err-${Date.now()}`;

      globalThis.fetch = (async () => {
        throw new Error('Upstream provider timeout');
      }) as any;

      const mockDm: any = {
        author: { id: userId, username: 'Trainer', bot: false },
        guild: null,
        guildId: null,
        content: 'Hello, this will fail',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => { sentContent = text; },
        },
      };

      await handleDirectMessage(mockDm);

      assert.equal(
        sentContent,
        "Sorry, I couldn't process your message right now.",
        'Must send exact fallback error message on failure'
      );
    });

    it('handles fan gain query in DM directly and responds with Fan Gain Summary', async () => {
      let sentContent = '';
      const userId = `dm-user-fangain-${Date.now()}`;

      const mockDm: any = {
        author: { id: userId, username: 'TrainerFan', bot: false },
        guild: null,
        guildId: null,
        content: 'how many fans did I gain today',
        reply: async (text: string) => { sentContent = text; },
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => { sentContent = text; },
        },
      };

      await handleDirectMessage(mockDm);

      assert.ok(sentContent.includes('📈 Fan Gain Summary'), 'Must return Fan Gain Summary header');
      assert.ok(sentContent.includes('Fan Gain:'), 'Must include Fan Gain section');
      assert.ok(sentContent.includes('Current Rank:'), 'Must include Current Rank section');
    });

    it('handles leaderboard query in DM directly and responds with Leaderboard', async () => {
      let sentContent = '';
      const userId = `dm-user-leaderboard-${Date.now()}`;

      const mockDm: any = {
        author: { id: userId, username: 'TrainerLeader', bot: false },
        guild: null,
        guildId: null,
        content: 'show Umakraft 2 weekly leaderboard top 10',
        reply: async (text: string) => { sentContent = text; },
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => { sentContent = text; },
        },
      };

      await handleDirectMessage(mockDm);

      assert.ok(sentContent.includes('🏆 UmaKraft 2 Weekly Fan Gain Leaderboard'), 'Must return Leaderboard header');
      assert.ok(sentContent.includes('Your Rank:'), 'Must prioritize user rank first');
      assert.ok(sentContent.includes('Your Fan Gain:'), 'Must include user fan gain');
      assert.ok(sentContent.includes('Top 10 Trainers'), 'Must list top trainers');
    });
  });

  describe('/chat slash command handler verification', () => {
    it('/chat speak creates session and replies with embed', async () => {
      const { handleChat, chatCommand } = await import('../../apps/discord/src/chat.js');
      assert.equal(chatCommand.name, 'chat');

      let deferred = false;
      let replyOptions: any = null;

      globalThis.fetch = (async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'chatcmpl-test-chat-cmd',
            choices: [{ index: 0, message: { role: 'assistant', content: 'Hello Trainer via slash command!' } }],
          }),
        } as any;
      }) as any;

      const userId = `slash-user-${Date.now()}`;
      const channelId = `channel-${Date.now()}`;

      const mockInteraction: any = {
        user: { id: userId },
        channelId,
        deferReply: async () => { deferred = true; },
        editReply: async (opts: any) => { replyOptions = opts; },
        options: {
          getSubcommand: () => 'speak',
          getString: (name: string) => (name === 'message' ? 'Hello via /chat speak' : null),
        },
      };

      await handleChat(mockInteraction);

      assert.equal(deferred, true);
      assert.ok(replyOptions?.embeds?.length > 0, 'Must reply with embed');

      const session = await chatSessionStore.getSession(userId);
      assert.ok(session);
      assert.equal(session.channelId, channelId);
      assert.equal(session.turnCount, 1);
    });

    it('/chat reply rejects when no session exists', async () => {
      const { handleChat } = await import('../../apps/discord/src/chat.js');

      let replyOptions: any = null;
      const nonExistentUserId = `unregistered-user-${Date.now()}`;

      const mockInteraction: any = {
        user: { id: nonExistentUserId },
        channelId: 'channel-xyz',
        deferReply: async () => {},
        editReply: async (opts: any) => { replyOptions = opts; },
        options: {
          getSubcommand: () => 'reply',
          getString: () => 'continuing without speak',
        },
      };

      await handleChat(mockInteraction);

      const embedDescription = replyOptions?.embeds?.[0]?.data?.description ?? '';
      assert.ok(
        embedDescription.includes('/chat speak'),
        `Must redirect to /chat speak in embed, got: ${embedDescription}`
      );
    });
  });
});
