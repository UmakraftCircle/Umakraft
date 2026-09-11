import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry, ToolCallingAgent } from '@ai-agent-platform/core';
import {
  memoryService,
  allMemoryTools,
  getConversationHistoryTool,
  summarizeConversationTool,
  getUserProfileTool,
  saveUserFactTool,
  sharedUserMemoryStore,
} from '@ai-agent-platform/integrations';
import { generateChatResponse } from '../../apps/discord/src/chat.js';
import { buildAIService } from '../../apps/discord/src/bootstrap.js';

describe('Phase 7: Autonomous Agent Actions & Tool Execution', () => {
  const originalFetch = globalThis.fetch;
  const originalAiProvider = process.env['AI_PROVIDER'];
  const originalOpenAiKey = process.env['OPENAI_API_KEY'];

  beforeEach(async () => {
    process.env['AI_PROVIDER'] = 'openai';
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    await memoryService.clearHistory();
    // Ensure all memory tools are registered in ToolRegistry
    const registry = ToolRegistry.getInstance();
    for (const tool of allMemoryTools) {
      registry.register(tool);
    }
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

  describe('1. Tool Layer & Safety Architecture', () => {
    it('executes registered memory tools with validated parameters', async () => {
      const registry = ToolRegistry.getInstance();
      const userId = 'trainer_tools_101';

      // Save a user fact using save_user_fact tool
      const saveRes = await registry.execute('save_user_fact', {
        userId,
        fact: 'Trainer prefers stamina-focused training schedules',
        category: 'preference',
      });

      assert.equal(saveRes.success, true);
      assert.match((saveRes.data as any).message, /successfully saved/i);

      // Fetch user profile using get_user_profile tool
      const profileRes = await registry.execute('get_user_profile', { userId });
      assert.equal(profileRes.success, true);
      const data = profileRes.data as any;
      assert.equal(data.userId, userId);
      assert.ok(data.memories.some((m: any) => m.fact.includes('stamina-focused')));
    });

    it('rejects unregistered tool executions safely', async () => {
      const registry = ToolRegistry.getInstance();
      const res = await registry.execute('unauthorized_destructive_tool', { payload: 'drop' });
      assert.equal(res.success, false);
      assert.match(res.error || '', /no tool registered with slug/i);
    });

    it('validates tool parameters and enforces required fields', async () => {
      const registry = ToolRegistry.getInstance();
      // save_user_fact requires userId and fact
      const res = await registry.execute('save_user_fact', { userId: 'trainer_123' });
      assert.equal(res.success, false);
      assert.match(res.error || '', /Validation Error|required/i);
    });
  });

  describe('2. Memory Tools Execution Suite', () => {
    it('retrieves conversation history with get_conversation_history', async () => {
      const registry = ToolRegistry.getInstance();
      const userId = 'trainer_hist_user';

      await memoryService.saveUserMessage(userId, 'I am preparing for the Tenno Sho Spring');
      await memoryService.saveAssistantMessage(userId, 'Make sure to build up sufficient stamina and recovery skills.');

      const res = await registry.execute('get_conversation_history', { userId, limit: 5 });
      assert.equal(res.success, true);
      const data = res.data as any;
      assert.equal(data.count, 2);
      assert.match(data.messages[0].content, /Tenno Sho Spring/);
      assert.match(data.messages[1].content, /stamina and recovery/);
    });

    it('retrieves or updates conversation summaries with summarize_conversation', async () => {
      const registry = ToolRegistry.getInstance();
      const userId = 'trainer_summary_user';

      await memoryService.saveUserMessage(userId, 'My goal is winning URA Finals with Mejiro McQueen');
      await memoryService.saveAssistantMessage(userId, 'Excellent choice, let us focus on Long Distance and Stamina.');

      const res = await registry.execute('summarize_conversation', { userId });
      assert.equal(res.success, true);
      const data = res.data as any;
      assert.equal(data.userId, userId);
      assert.ok(typeof data.summary === 'string');
    });
  });

  describe('3. Autonomous Reasoning & Tool Calling Agent Flow', () => {
    it('reasoning layer calls get_user_profile on "Show my recent memory" query', async () => {
      const userId = 'trainer_agent_reason_1';
      const channelId = `discord-dm:${userId}`;

      // Seed a user fact
      await sharedUserMemoryStore.addMemory(userId, {
        userId,
        fact: 'Favorite turf surface is Firm',
        category: 'preference',
        importance: 0.95,
      });

      let toolCallsCount = 0;

      // Mock LLM generation simulating native tool selection and final answer synthesis
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const parsed = JSON.parse(bodyStr || '{}');
        const msgs = parsed.messages || [];
        const userPrompt = msgs[msgs.length - 1]?.content || '';

        // Step 1: Model decides to call get_user_profile tool via tool_calls
        if (!userPrompt.includes('Tool get_user_profile returned:')) {
          toolCallsCount++;
          return new Response(JSON.stringify({
            choices: [{
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [{
                  id: 'call_profile_1',
                  type: 'function',
                  function: {
                    name: 'get_user_profile',
                    arguments: JSON.stringify({ userId }),
                  },
                }],
              },
            }],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Step 2: Model synthesizes final response from tool result
        return new Response(JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: 'Here is your stored memory, Trainer: Your favorite turf condition is Firm.',
            },
          }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as any;

      const reply = await generateChatResponse({
        userId,
        channelId,
        message: 'Show my recent memory',
        subcommand: 'auto',
      });

      assert.ok(toolCallsCount >= 1, 'Agent must autonomously select and invoke the tool');
      assert.match(reply, /Firm|stored memory/i);
    });

    it('reasoning layer calls summarize_conversation on "Summarize our last conversation"', async () => {
      const userId = 'trainer_agent_reason_2';
      const channelId = `discord-dm:${userId}`;

      await memoryService.saveUserMessage(userId, 'We planned a 5-day speed training regimen for Silence Suzuka.');
      await memoryService.saveAssistantMessage(userId, 'Noted. Pacing drills set for days 1 and 3.');

      let toolExecuted = false;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const parsed = JSON.parse(bodyStr || '{}');
        const msgs = parsed.messages || [];
        const userPrompt = msgs[msgs.length - 1]?.content || '';

        if (!userPrompt.includes('Tool summarize_conversation returned:')) {
          toolExecuted = true;
          return new Response(JSON.stringify({
            choices: [{
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [{
                  id: 'call_summary_1',
                  type: 'function',
                  function: {
                    name: 'summarize_conversation',
                    arguments: JSON.stringify({ userId }),
                  },
                }],
              },
            }],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: 'Summary: We discussed a 5-day speed training regimen with pacing drills for Silence Suzuka.',
            },
          }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as any;

      const reply = await generateChatResponse({
        userId,
        channelId,
        message: 'Summarize our last conversation',
        subcommand: 'auto',
      });

      assert.equal(toolExecuted, true);
      assert.match(reply, /Silence Suzuka|regimen|Summary/i);
    });

    it('handles tool execution errors gracefully and returns composed answer', async () => {
      const aiService = buildAIService();
      const registry = ToolRegistry.getInstance();
      const agent = new ToolCallingAgent(aiService, registry);

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const parsed = JSON.parse(bodyStr || '{}');
        const msgs = parsed.messages || [];
        const userPrompt = msgs[msgs.length - 1]?.content || '';

        // Model calls tool with missing required argument
        if (!userPrompt.includes('Tool get_user_profile returned:')) {
          return new Response(JSON.stringify({
            choices: [{
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [{
                  id: 'call_err_1',
                  type: 'function',
                  function: {
                    name: 'get_user_profile',
                    arguments: JSON.stringify({}), // missing required userId
                  },
                }],
              },
            }],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Model acknowledges error and provides friendly fallback
        return new Response(JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: 'I could not retrieve the profile at this moment, but I am ready to help you.',
            },
          }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as any;

      const res = await agent.run('user_err_test', 'Check my profile');
      assert.match(res, /ready to help you|could not retrieve/i);
    });
  });
});
