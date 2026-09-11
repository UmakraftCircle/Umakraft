import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fingerprintCall, ToolCallingAgent } from '../../packages/core/src/tool-calling-agent.js';
import { ToolRegistry } from '../../packages/core/src/tool-registry.js';
import { AIService } from '../../packages/ai/src/index.js';

class MockAIService extends AIService {
  private responses: any[];
  private index = 0;

  constructor(responses: any[]) {
    super('mock-model');
    this.responses = responses;
  }

  async generate(): Promise<string> {
    return 'mock text';
  }

  async generateStructuredOutput(): Promise<any> {
    const res = this.responses[this.index] ?? { answer: 'default answer' };
    this.index++;
    return res;
  }
}

describe('ToolCallingAgent & fingerprintCall', () => {
  describe('fingerprintCall', () => {
    it('normalizes string casing, whitespace, and sorts parameter keys', () => {
      const call1 = {
        slug: 'search_web',
        args: { query: '  Tokyo   Weather  ', limit: 5 },
      };
      const call2 = {
        slug: 'search_web',
        args: { limit: 5, query: 'tokyo weather' },
      };

      const fp1 = fingerprintCall(call1);
      const fp2 = fingerprintCall(call2);

      assert.equal(fp1, fp2);
      assert.equal(fp1, 'search_web:{"limit":5,"query":"tokyo weather"}');
    });
  });

  describe('ToolCallingAgent runtime behavior', () => {
    it('executes tool calls and handles repeat detection via cache', async () => {
      let toolCallCount = 0;
      const registry = ToolRegistry.getInstance();
      registry.register({
        slug: 'mock_lookup',
        name: 'Mock Lookup',
        description: 'Lookup mock info',
        parameters: [],
        handler: async (args: any) => {
          toolCallCount++;
          return `Result for ${args.id}`;
        },
      });

      // Model first calls mock_lookup, then repeats the exact call, then gives an answer
      const aiService = new MockAIService([
        { action: 'mock_lookup', parameters: { id: 'item-1' } },
        { action: 'mock_lookup', parameters: { id: 'item-1' } },
        { answer: 'Final synthesized answer with data' },
      ]);

      const agent = new ToolCallingAgent(aiService, registry);
      const trace = await agent.runWithTrace('user-1', 'Look up item-1');

      assert.equal(trace.answer, 'Final synthesized answer with data');
      // The tool handler should only have been executed ONCE due to repeat detection cache!
      assert.equal(toolCallCount, 1);
      // Log should contain repeat_detected event
      assert.ok(trace.logs?.some((l) => l.event === 'repeat_detected'));
    });

    it('enforces per-tool budgets and stops early', async () => {
      const registry = ToolRegistry.getInstance();
      registry.register({
        slug: 'expensive_tool',
        name: 'Expensive Tool',
        description: 'Tool with tight budget',
        parameters: [],
        handler: async () => 'data',
      });

      // Model tries to call expensive_tool multiple times
      const aiService = new MockAIService([
        { action: 'expensive_tool', parameters: {} },
        { action: 'expensive_tool', parameters: { diff: true } },
      ]);

      const agent = new ToolCallingAgent(aiService, registry);
      const trace = await agent.runWithTrace('user-1', 'Run expensive tool', undefined, {
        toolBudgets: { expensive_tool: 1 },
      });

      assert.equal(trace.finalizeReason, 'per_tool_budget');
      assert.ok(trace.answer.includes('expensive_tool'));
    });
  });
});
