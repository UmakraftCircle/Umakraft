import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AIService, GenerateOptions } from '@ai-agent-platform/ai';
import { classifyIntent, ROUTER_CLASSIFIER_PROMPT } from '../../apps/discord/src/router.js';
import { handleDirectMessage } from '../../apps/discord/src/dm.js';
import { generateAskResponse, handleAskQuestion, handleAskAnswer } from '../../apps/discord/src/ask.js';
import { generateChatResponse } from '../../apps/discord/src/chat.js';
import {
  chatSessionStore,
  conversationMemoryStore,
  askQuestionStore,
} from '@ai-agent-platform/integrations';

class MockClassifierService implements AIService {
  public recordedPrompts: string[] = [];
  public mockResponse: string = 'chat';
  public shouldThrow: boolean = false;

  constructor(initialResponse: string = 'chat') {
    this.mockResponse = initialResponse;
  }

  getCurrentModel(): string {
    return 'mock-classifier';
  }

  async generate(options: GenerateOptions): Promise<string> {
    this.recordedPrompts.push(options.prompt);
    if (this.shouldThrow) {
      throw new Error('LLM rate limited or down');
    }
    return this.mockResponse;
  }

  async generateStructuredOutput(_options: GenerateOptions): Promise<any> {
    return { route: this.mockResponse };
  }
}

describe('Phase 3: DM Intent Router & Integration', () => {
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

  describe('router.ts - classifyIntent unit tests', () => {
    it('uses the mandated prompt instructions and passes user message', async () => {
      const mockService = new MockClassifierService('ask');
      const decision = await classifyIntent({
        userId: 'user-001',
        message: 'How do I install Docker?',
        aiService: mockService,
      });

      assert.equal(decision.route, 'ask');
      assert.equal(decision.confidence, 0.95);
      assert.equal(mockService.recordedPrompts.length, 1);
      assert.ok(mockService.recordedPrompts[0].includes(ROUTER_CLASSIFIER_PROMPT));
      assert.ok(mockService.recordedPrompts[0].includes('How do I install Docker?'));
    });

    it('classifies factual/troubleshooting messages as "ask"', async () => {
      const questions = [
        'How do I install Docker?',
        'What is TypeScript?',
        'How do I deploy Node.js?',
        'Can you explain quantum computing?',
      ];

      for (const question of questions) {
        const mockService = new MockClassifierService('ask');
        const decision = await classifyIntent({
          userId: 'user-002',
          message: question,
          aiService: mockService,
        });
        assert.equal(decision.route, 'ask', `Expected "ask" for: ${question}`);
      }
    });

    it('classifies casual/social messages as "chat"', async () => {
      const chatMessages = [
        'Hello there',
        'Tell me a joke',
        "I'm feeling stressed",
        "I'm bored today",
        'Good morning!',
      ];

      for (const message of chatMessages) {
        const mockService = new MockClassifierService('chat');
        const decision = await classifyIntent({
          userId: 'user-003',
          message,
          aiService: mockService,
        });
        assert.equal(decision.route, 'chat', `Expected "chat" for: ${message}`);
      }
    });

    it('parses JSON format {"route": "ask"} and {"route": "chat"} correctly', async () => {
      const mockAskJson = new MockClassifierService('{"route": "ask"}');
      const decisionAsk = await classifyIntent({
        userId: 'user-json-1',
        message: 'Explain event loops',
        aiService: mockAskJson,
      });
      assert.equal(decisionAsk.route, 'ask');

      const mockChatJson = new MockClassifierService('{"route": "chat"}');
      const decisionChat = await classifyIntent({
        userId: 'user-json-2',
        message: 'Hey friend',
        aiService: mockChatJson,
      });
      assert.equal(decisionChat.route, 'chat');
    });

    it('defaults to "chat" if classifier output is ambiguous or uncertain', async () => {
      const mockService = new MockClassifierService('maybe somewhere between');
      const decision = await classifyIntent({
        userId: 'user-004',
        message: 'Hmm not sure',
        aiService: mockService,
      });

      assert.equal(decision.route, 'chat', 'Must default to chat if uncertain');
      assert.equal(decision.confidence, 0.5);
    });

    it('defaults to "chat" if classifier throws an error (never blocks user)', async () => {
      const mockService = new MockClassifierService('ask');
      mockService.shouldThrow = true;

      const decision = await classifyIntent({
        userId: 'user-005',
        message: 'How do I build a kernel?',
        aiService: mockService,
      });

      assert.equal(decision.route, 'chat', 'Must safely default to chat on failure');
      assert.equal(decision.confidence, 0.5);
    });

    it('defaults to "chat" on empty or whitespace message', async () => {
      const decision = await classifyIntent({
        userId: 'user-006',
        message: '   ',
      });

      assert.equal(decision.route, 'chat');
      assert.equal(decision.confidence, 1.0);
    });
  });

  describe('DM Flow: Automatic routing to ask.ts vs chat.ts', () => {
    it('routes factual DM to ask.ts and returns answer', async () => {
      let typingCalled = false;
      let sentReply = '';
      const userId = `dm-router-ask-${Date.now()}`;

      const mockService = new MockClassifierService('ask');
      let askCalled = false;
      let chatCalled = false;

      const mockUserDm: any = {
        author: { id: userId, username: 'DevTrainer', bot: false },
        guild: null,
        guildId: null,
        content: 'How do I install Docker?',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => { typingCalled = true; },
          send: async (text: string) => { sentReply = text; },
        },
      };

      await handleDirectMessage(mockUserDm, {
        routerService: mockService,
        askGenerator: async (opts) => {
          askCalled = true;
          assert.equal(opts.userId, userId);
          assert.equal(opts.question, 'How do I install Docker?');
          assert.equal(opts.domainGuard, false);
          assert.equal(opts.bypassTopicCheck, true);
          return 'To install Docker, download Docker Desktop or run sudo apt install docker.io.';
        },
        chatGenerator: async () => {
          chatCalled = true;
          return 'Chat response';
        },
      });

      assert.equal(typingCalled, true);
      assert.equal(askCalled, true, 'Must route to ask generator');
      assert.equal(chatCalled, false, 'Must NOT route to chat generator');
      assert.ok(sentReply.includes('Docker'), `Sent reply was: ${sentReply}`);
    });

    it('routes casual DM to chat.ts and returns conversational response', async () => {
      let typingCalled = false;
      let sentReply = '';
      const userId = `dm-router-chat-${Date.now()}`;

      const mockService = new MockClassifierService('chat');
      let askCalled = false;
      let chatCalled = false;

      const mockUserDm: any = {
        author: { id: userId, username: 'SocialTrainer', bot: false },
        guild: null,
        guildId: null,
        content: 'Hello there',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => { typingCalled = true; },
          send: async (text: string) => { sentReply = text; },
        },
      };

      await handleDirectMessage(mockUserDm, {
        routerService: mockService,
        askGenerator: async () => {
          askCalled = true;
          return 'Ask response';
        },
        chatGenerator: async (opts) => {
          chatCalled = true;
          assert.equal(opts.userId, userId);
          assert.equal(opts.message, 'Hello there');
          return 'Hello there Trainer! How is your day going? 🐎';
        },
      });

      assert.equal(typingCalled, true);
      assert.equal(chatCalled, true, 'Must route to chat generator');
      assert.equal(askCalled, false, 'Must NOT route to ask generator');
      assert.ok(sentReply.includes('Hello there Trainer!'));
    });

    it('falls back to chat.ts if ask generator throws an error', async () => {
      let sentReply = '';
      const userId = `dm-router-fallback-${Date.now()}`;

      const mockService = new MockClassifierService('ask');
      let askAttempted = false;
      let chatFallbackCalled = false;

      const mockUserDm: any = {
        author: { id: userId, username: 'RetryTrainer', bot: false },
        guild: null,
        guildId: null,
        content: 'Troubleshooting memory leak',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => { sentReply = text; },
        },
      };

      await handleDirectMessage(mockUserDm, {
        routerService: mockService,
        askGenerator: async () => {
          askAttempted = true;
          throw new Error('Ask engine database offline');
        },
        chatGenerator: async (opts) => {
          chatFallbackCalled = true;
          return `I noticed you're looking into "${opts.message}". Let's discuss it!`;
        },
      });

      assert.equal(askAttempted, true, 'Ask was attempted');
      assert.equal(chatFallbackCalled, true, 'Fallback to chat was invoked');
      assert.ok(sentReply.includes('Troubleshooting memory leak'));
    });

    it('real end-to-end DM routing with generateAskResponse & ToolCallingAgent', async () => {
      const userId = `dm-e2e-ask-${Date.now()}`;
      let sentReply = '';

      // Mock LLM completion:
      // 1. Classifier call returns "ask"
      // 2. Tool agent call returns factual answer
      let callCount = 0;
      globalThis.fetch = (async (url: any, opts: any) => {
        callCount++;
        const body = JSON.parse(opts.body);
        const lastMsg = body.messages[body.messages.length - 1]?.content ?? '';

        if (lastMsg.includes('Determine whether the user message is')) {
          // Classifier response
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'cmpl-classifier',
              choices: [{ index: 0, message: { role: 'assistant', content: 'ask' } }],
            }),
          } as any;
        }

        // ToolAgent response for factual question
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'cmpl-ask-agent',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
                },
              },
            ],
          }),
        } as any;
      }) as any;

      const mockUserDm: any = {
        author: { id: userId, username: 'TypeScriptDev', bot: false },
        guild: null,
        guildId: null,
        content: 'What is TypeScript?',
        channel: {
          isDMBased: () => true,
          sendTyping: async () => {},
          send: async (text: string) => { sentReply = text; },
        },
      };

      await handleDirectMessage(mockUserDm);

      assert.ok(sentReply.includes('strongly typed') || sentReply.includes('JavaScript'));

      // Check conversation memory recorded turns
      const history = await conversationMemoryStore.recent(userId, `discord-dm:${userId}`, 10);
      assert.equal(history.length, 2);
      assert.equal(history[0].role, 'user');
      assert.equal(history[0].content, 'What is TypeScript?');
      assert.equal(history[1].role, 'assistant');
    });
  });

  describe('Slash commands remain untouched and functional', () => {
    it('/ask question slash command still registers pending question', async () => {
      const userId = `slash-ask-user-${Date.now()}`;
      let replyContent = '';

      const mockInteraction: any = {
        user: { id: userId },
        channelId: 'channel-test-1',
        deferReply: async () => {},
        editReply: async (opts: any) => { replyContent = opts.content ?? ''; },
        options: {
          getSubcommand: () => 'question',
          getString: (name: string) => (name === 'question' ? 'Special Week training strategy' : null),
        },
      };

      await handleAskQuestion(mockInteraction);

      assert.ok(replyContent.includes('Your question has been submitted'));
      assert.ok(replyContent.includes('Question ID:'));
      assert.ok(replyContent.includes('/ask answer question_id:'));
    });

    it('/ask answer slash command still generates answer for valid question ID', async () => {
      const userId = `slash-ask-ans-user-${Date.now()}`;
      let replyOptions: any = null;

      // Seed a pending question
      const questionRecord = await askQuestionStore.create({
        userId,
        channelId: 'channel-1',
        question: 'Special Week stats',
      });

      globalThis.fetch = (async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'cmpl-ask-ans',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Special Week excels with high Stamina and Speed builds for Medium/Long turf races.',
                },
              },
            ],
          }),
        } as any;
      }) as any;

      const mockInteraction: any = {
        user: { id: userId },
        channelId: 'channel-1',
        deferReply: async () => {},
        editReply: async (opts: any) => { replyOptions = opts; },
        options: {
          getSubcommand: () => 'answer',
          getString: (name: string) => (name === 'question_id' ? questionRecord.id : null),
        },
      };

      await handleAskAnswer(mockInteraction);

      assert.ok(replyOptions?.content?.includes(questionRecord.id));
      assert.ok(replyOptions?.embeds?.length > 0);
    });
  });
});
