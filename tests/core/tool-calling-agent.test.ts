import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ToolCallingAgent, ToolRegistry } from '@ai-agent-platform/core';
import type { AIService, GenerateStructuredOutputOptions } from '@ai-agent-platform/ai';

class MockAIService implements AIService {
  public calls: GenerateStructuredOutputOptions[] = [];
  public responses: any[] = [];

  async generateStructuredOutput<T>(options: GenerateStructuredOutputOptions): Promise<T> {
    this.calls.push(options);
    const next = this.responses.shift();
    if (next instanceof Error) {
      throw next;
    }
    return (next ?? { answer: 'default answer' }) as T;
  }
}

describe('ToolCallingAgent', () => {
  let mockAI: MockAIService;
  let registry: ToolRegistry;
  let agent: ToolCallingAgent;

  beforeEach(() => {
    mockAI = new MockAIService();
    registry = new ToolRegistry();
    agent = new ToolCallingAgent(mockAI, registry);
  });

  it('returns a direct answer without tool calls', async () => {
    mockAI.responses = [{ answer: 'Hello Trainer!' }];

    const answer = await agent.run('user-1', 'Hi there');
    assert.equal(answer, 'Hello Trainer!');
    assert.equal(mockAI.calls.length, 1);
  });

  it('executes a tool and provides the final answer', async () => {
    registry.register({
      slug: 'get_fan_count',
      description: 'Get fan count for a trainer',
      parameters: {
        type: 'object',
        properties: { trainer: { type: 'string' } },
        required: ['trainer'],
      },
      handler: async (params) => ({ trainer: params.trainer, fans: 1500000 }),
    });

    mockAI.responses = [
      { action: 'get_fan_count', parameters: { trainer: 'SpecialWeek' } },
      { answer: 'SpecialWeek has 1,500,000 fans!' },
    ];

    const trace = await agent.runWithTrace('user-1', 'How many fans does SpecialWeek have?');
    assert.equal(trace.answer, 'SpecialWeek has 1,500,000 fans!');
    assert.equal(trace.usedWebSearch, false);
    assert.equal(mockAI.calls.length, 2);
  });

  it('handles tool execution failures gracefully', async () => {
    registry.register({
      slug: 'failing_tool',
      description: 'A tool that fails',
      parameters: { type: 'object' },
      handler: async () => {
        throw new Error('API network failure');
      },
    });

    mockAI.responses = [
      { action: 'failing_tool', parameters: {} },
      { answer: 'The tool failed so I am answering directly.' },
    ];

    const answer = await agent.run('user-1', 'Run failing tool');
    assert.equal(answer, 'The tool failed so I am answering directly.');
    assert.equal(mockAI.calls.length, 2);
  });

  it('stops when max tool calls is reached', async () => {
    registry.register({
      slug: 'looping_tool',
      description: 'Loops',
      parameters: { type: 'object' },
      handler: async () => ({ status: 'ok' }),
    });

    mockAI.responses = [
      { action: 'looping_tool', parameters: {} },
      { action: 'looping_tool', parameters: {} },
      { action: 'looping_tool', parameters: {} },
    ];

    const answer = await agent.run('user-1', 'Loop me', undefined, { maxToolCalls: 2 });
    assert.match(answer, /limit/i);
  });

  it('enforces web search limit', async () => {
    registry.register({
      slug: 'search_web',
      description: 'Web search',
      parameters: { type: 'object' },
      handler: async () => ({ results: [] }),
    });

    mockAI.responses = [
      { action: 'search_web', parameters: {} },
      { action: 'search_web', parameters: {} },
    ];

    const trace = await agent.runWithTrace('user-1', 'Search query', undefined, {
      maxToolCalls: 5,
      maxWebSearches: 1,
    });
    assert.match(trace.answer, /web-search limit/i);
    assert.equal(trace.usedWebSearch, true);
  });

  it('applies systemPromptPrefix and domainGuard configuration', async () => {
    mockAI.responses = [{ answer: 'Custom persona response' }];

    await agent.run('user-1', 'Greetings', undefined, {
      systemPromptPrefix: 'CUSTOM_PERSONA_HEADER',
      domainGuard: true,
    });

    assert.equal(mockAI.calls.length, 1);
    assert.ok(mockAI.calls[0].system.includes('CUSTOM_PERSONA_HEADER'));
    assert.ok(mockAI.calls[0].system.includes('[[OFFTOPIC]]'));
  });
});
