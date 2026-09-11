import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  conversationMemoryStore,
  MAX_MESSAGES,
  type ChatMessage,
} from '@ai-agent-platform/integrations';
import { generateChatResponse } from '../../apps/discord/src/chat.js';
import { handleDirectMessage } from '../../apps/discord/src/dm.js';

describe('Phase 5: Conversation Memory & Context Management', () => {
  const originalFetch = globalThis.fetch;
  const originalAiProvider = process.env['AI_PROVIDER'];
  const originalOpenAiKey = process.env['OPENAI_API_KEY'];
  const originalSimThreshold = process.env['CHAT_SIMILARITY_THRESHOLD'];

  beforeEach(() => {
    process.env['AI_PROVIDER'] = 'openai';
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    process.env['CHAT_SIMILARITY_THRESHOLD'] = '0.95';
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

  describe('1. Isolated Conversation Store Keyed by User ID', () => {
    it('creates and retrieves history keyed by Discord user ID', () => {
      const userId = 'user_john_123';
      const initial = conversationMemoryStore.getConversation(userId);
      assert.deepEqual(initial, []);

      conversationMemoryStore.addMessage(userId, 'user', 'Hello there');
      conversationMemoryStore.addMessage(userId, 'assistant', 'Hello! How can I help you today?');

      const history = conversationMemoryStore.getConversation(userId);
      assert.equal(history.length, 2);
      assert.equal(history[0].role, 'user');
      assert.equal(history[0].content, 'Hello there');
      assert.equal(history[1].role, 'assistant');
      assert.equal(history[1].content, 'Hello! How can I help you today?');
    });

    it('isolates memory between multiple users (User A -> Memory A, User B -> Memory B)', () => {
      const userA = 'discord_user_a';
      const userB = 'discord_user_b';

      conversationMemoryStore.addMessage(userA, 'user', 'My secret keyword is PEACH');
      conversationMemoryStore.addMessage(userA, 'assistant', 'I will remember your secret keyword.');

      conversationMemoryStore.addMessage(userB, 'user', 'My favorite animal is Capybara');
      conversationMemoryStore.addMessage(userB, 'assistant', 'Capybaras are wonderful!');

      const historyA = conversationMemoryStore.getConversation(userA);
      const historyB = conversationMemoryStore.getConversation(userB);

      assert.equal(historyA.length, 2);
      assert.equal(historyB.length, 2);

      // Verify User A history does not contain User B content
      assert.ok(historyA.some((m) => m.content.includes('PEACH')));
      assert.ok(!historyA.some((m) => m.content.includes('Capybara')));

      // Verify User B history does not contain User A content
      assert.ok(historyB.some((m) => m.content.includes('Capybara')));
      assert.ok(!historyB.some((m) => m.content.includes('PEACH')));
    });

    it('clears specific user memory without affecting others', () => {
      const userA = 'user_101';
      const userB = 'user_102';

      conversationMemoryStore.addMessage(userA, 'user', 'User A message');
      conversationMemoryStore.addMessage(userB, 'user', 'User B message');

      conversationMemoryStore.clear(userA);

      assert.deepEqual(conversationMemoryStore.getConversation(userA), []);
      assert.equal(conversationMemoryStore.getConversation(userB).length, 1);
      assert.equal(conversationMemoryStore.getConversation(userB)[0].content, 'User B message');
    });
  });

  describe('2. History Limits (Sliding Window MAX_MESSAGES = 20)', () => {
    it('enforces maximum 20 messages sliding window limit', () => {
      const userId = 'chatty_user_456';

      // Push 30 messages
      for (let i = 1; i <= 30; i++) {
        const role = i % 2 === 1 ? 'user' : 'assistant';
        conversationMemoryStore.addMessage(userId, role, `Message turn ${i}`);
      }

      const history = conversationMemoryStore.getConversation(userId);
      assert.equal(history.length, MAX_MESSAGES);
      assert.equal(MAX_MESSAGES, 20);

      // Oldest retained message should be turn 11 (30 - 20 + 1 = 11)
      assert.equal(history[0].content, 'Message turn 11');
      assert.equal(history[history.length - 1].content, 'Message turn 30');
    });

    it('formats formatted context turns correctly for LLM prompt injection', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hi bot' },
        { role: 'assistant', content: 'Hello Trainer!' },
        { role: 'user', content: 'How is the weather?' },
      ];

      const formatted = conversationMemoryStore.formatContext(messages);
      assert.equal(
        formatted,
        'Trainer: Hi bot\nAssistant: Hello Trainer!\nTrainer: How is the weather?'
      );
    });
  });

  describe('3. Multi-Turn Contextual Response & Success Criteria', () => {
    it('remembers user name across multiple conversation turns', async () => {
      const userId = 'user_john_turn_test';
      const channelId = `discord-dm:${userId}`;

      const promptsReceived: string[] = [];

      globalThis.fetch = (async (url: any, init: any) => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const body = JSON.parse(bodyStr || '{}');
        const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';
        promptsReceived.push(userPrompt);

        if (userPrompt.includes('What is my name') || userPrompt.includes("What's my name")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      answer: 'Your name is John.',
                    }),
                  },
                },
              ],
            }),
          } as any;
        }

        if (userPrompt.includes('My name is John')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      answer: 'Nice to meet you John.',
                    }),
                  },
                },
              ],
            }),
          } as any;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: 'Hello!',
                  }),
                },
              },
            ],
          }),
        } as any;
      }) as typeof fetch;

      // Turn 1: User: Hi -> Bot: Hello!
      const reply1 = await generateChatResponse({
        userId,
        channelId,
        message: 'Hi',
        subcommand: 'auto',
      });
      assert.ok(reply1.includes('Hello'));

      // Turn 2: User: My name is John -> Bot: Nice to meet you John.
      const reply2 = await generateChatResponse({
        userId,
        channelId,
        message: 'My name is John',
        subcommand: 'auto',
      });
      assert.ok(reply2.includes('Nice to meet you John'));

      // Turn 3: User: What's my name? -> Bot: Your name is John.
      const reply3 = await generateChatResponse({
        userId,
        channelId,
        message: "What's my name?",
        subcommand: 'auto',
      });
      assert.ok(reply3.includes('John'));

      // Verify that the LLM received the previous conversation context in Turn 3
      const lastPrompt = promptsReceived[promptsReceived.length - 1];
      assert.ok(
        lastPrompt.includes('My name is John') || lastPrompt.includes('Trainer: My name is John'),
        'Turn 3 prompt must contain earlier conversation turns with John'
      );
    });

    it('fulfills success criteria: User expresses favorite color, then asks for it in next turn', async () => {
      const userId = 'user_color_test';
      const channelId = `discord-dm:${userId}`;

      const promptsReceived: string[] = [];

      globalThis.fetch = (async (url: any, init: any) => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const body = JSON.parse(bodyStr || '{}');
        const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';
        const systemPrompt = body.messages?.[0]?.content || '';
        promptsReceived.push(userPrompt);

        // Handle memory extraction structured output if triggered
        if (systemPrompt.includes('MEMORY EXTRACTION') || userPrompt.includes('MEMORY EXTRACTION')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      extractedFacts: [],
                      profilePatch: { preferences: ['favorite color is blue'] },
                      explanation: 'Extracted favorite color',
                    }),
                  },
                },
              ],
            }),
          } as any;
        }

        if (userPrompt.includes('What is my favorite color') || userPrompt.includes('favorite color?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: 'Your favorite color is blue.',
                  },
                },
              ],
            }),
          } as any;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Got it.',
                },
              },
            ],
          }),
        } as any;
      }) as typeof fetch;

      // Turn 1: "My favorite color is blue." -> "Got it."
      const reply1 = await generateChatResponse({
        userId,
        channelId,
        message: 'My favorite color is blue.',
        subcommand: 'auto',
      });
      assert.equal(reply1, 'Got it.');

      // Turn 2: "What is my favorite color?" -> "Your favorite color is blue."
      const reply2 = await generateChatResponse({
        userId,
        channelId,
        message: 'What is my favorite color?',
        subcommand: 'auto',
      });
      assert.equal(reply2, 'Your favorite color is blue.');

      // Verify conversation history stored in conversation store
      const history = conversationMemoryStore.getConversation(userId);
      assert.equal(history.length, 4);
      assert.equal(history[0].content, 'My favorite color is blue.');
      assert.equal(history[1].content, 'Got it.');
      assert.equal(history[2].content, 'What is my favorite color?');
      assert.equal(history[3].content, 'Your favorite color is blue.');
    });
  });

  describe('4. End-to-End Direct Message Session Handling', () => {
    it('maintains multi-turn context when receiving DMs via handleDirectMessage', async () => {
      const userId = 'discord_dm_trainer_99';
      const sentMessages: string[] = [];

      const mockMessage = (content: string) =>
        ({
          author: { id: userId, username: 'TrainerRed', bot: false },
          guild: null,
          guildId: null,
          channel: {
            isDMBased: () => true,
            sendTyping: async () => {},
            send: async (text: string) => {
              sentMessages.push(text);
            },
          },
          content,
        }) as any;

      globalThis.fetch = (async (url: any, init: any) => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const body = JSON.parse(bodyStr || '{}');
        const userPrompt = body.messages?.[body.messages.length - 1]?.content || '';

        if (userPrompt.includes('Remember project code NOVA')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      answer: 'Project code NOVA has been stored.',
                    }),
                  },
                },
              ],
            }),
          } as any;
        }

        if (userPrompt.includes('What project code did I give you')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      answer: 'You gave me project code NOVA.',
                    }),
                  },
                },
              ],
            }),
          } as any;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: 'Understood Trainer!',
                  }),
                },
              },
            ],
          }),
        } as any;
      }) as typeof fetch;

      // DM 1
      await handleDirectMessage(mockMessage('Remember project code NOVA'));
      assert.equal(sentMessages.length, 1);
      assert.ok(sentMessages[0].includes('stored'));

      // DM 2
      await handleDirectMessage(mockMessage('What project code did I give you?'));
      assert.equal(sentMessages.length, 2);
      assert.ok(sentMessages[1].includes('NOVA'));

      // Verify conversation history in memory store
      const history = conversationMemoryStore.getConversation(userId);
      assert.equal(history.length, 4);
    });
  });
});
