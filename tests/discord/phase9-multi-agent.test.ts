import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  AgentOrchestrator,
  RouterAgent,
  KnowledgeAgent,
  MemoryAgent,
  ToolAgent,
  ModerationAgent,
  ToolRegistry,
  type AgentInput,
} from '@ai-agent-platform/core';
import {
  allKnowledgeTools,
  allMemoryTools,
  searchWebTool,
} from '@ai-agent-platform/integrations';
import { MockAIService, AIService, OpenAIProvider, type GenerateOptions } from '@ai-agent-platform/ai';
import { routeMultiAgent, getOrchestrator } from '../../apps/discord/src/router.js';

class CustomTestAIService extends OpenAIProvider {
  private customResponses: string[] = [];

  constructor() {
    super('mock-openai-key', 'gpt-4o-mini');
  }

  setCustomResponse(res: string) {
    this.customResponses.push(res);
  }

  override async generate(options: GenerateOptions): Promise<string> {
    if (this.customResponses.length > 0) {
      return this.customResponses.shift()!;
    }
    return super.generate(options);
  }
}

describe('Phase 9: Multi-Agent System & Agent Orchestration', () => {
  let mockAi: CustomTestAIService;
  let registry: ToolRegistry;
  let orchestrator: AgentOrchestrator;
  let originalFetch: typeof globalThis.fetch;
  let originalProvider: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalProvider = process.env['AI_PROVIDER'];
    process.env['AI_PROVIDER'] = 'openai';
    process.env['OPENAI_API_KEY'] = 'mock-openai-key';

    mockAi = new CustomTestAIService();
    registry = ToolRegistry.getInstance();

    // Register test tools
    registry.register(searchWebTool);
    for (const tool of allMemoryTools) {
      registry.register(tool);
    }
    for (const tool of allKnowledgeTools) {
      registry.register(tool);
    }

    orchestrator = new AgentOrchestrator({
      aiService: mockAi,
      registry,
      maxDelegationDepth: 3,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalProvider !== undefined) {
      process.env['AI_PROVIDER'] = originalProvider;
    } else {
      delete process.env['AI_PROVIDER'];
    }
    delete process.env['OPENAI_API_KEY'];
  });

  describe('1. Specialized Agent Registration & Interface Conformance', () => {
    it('registers all required specialized agents', () => {
      const agents = orchestrator.listAgents();
      assert.strictEqual(agents.length >= 4, true);

      const knowledgeAgent = orchestrator.getAgent('knowledge-agent');
      const memoryAgent = orchestrator.getAgent('memory-agent');
      const toolAgent = orchestrator.getAgent('tool-agent');
      const moderationAgent = orchestrator.getAgent('moderation-agent');

      assert.ok(knowledgeAgent, 'knowledge-agent should be registered');
      assert.ok(memoryAgent, 'memory-agent should be registered');
      assert.ok(toolAgent, 'tool-agent should be registered');
      assert.ok(moderationAgent, 'moderation-agent should be registered');

      assert.strictEqual(knowledgeAgent?.name, 'Knowledge Agent');
      assert.strictEqual(memoryAgent?.name, 'Memory Agent');
      assert.strictEqual(toolAgent?.name, 'Tool Agent');
      assert.strictEqual(moderationAgent?.name, 'Moderation Agent');
    });

    it('enforces specialized tool allowlists per agent', () => {
      const knowledgeAgent = orchestrator.getAgent('knowledge-agent')!;
      const memoryAgent = orchestrator.getAgent('memory-agent')!;
      const moderationAgent = orchestrator.getAgent('moderation-agent')!;

      assert.ok(knowledgeAgent.allowedTools.includes('search_knowledge'));
      assert.ok(knowledgeAgent.allowedTools.includes('retrieve_document'));
      assert.ok(!knowledgeAgent.allowedTools.includes('save_user_fact'));

      assert.ok(memoryAgent.allowedTools.includes('get_conversation_history'));
      assert.ok(memoryAgent.allowedTools.includes('save_user_fact'));
      assert.ok(!memoryAgent.allowedTools.includes('search_knowledge'));

      assert.strictEqual(moderationAgent.allowedTools.length, 0);
    });
  });

  describe('2. Intent Classification & Dynamic Routing', () => {
    it('routes "How do I deploy this project?" to Knowledge Agent', async () => {
      const input: AgentInput = {
        userId: 'trainer_1',
        message: 'How do I deploy this project on Cloud Run?',
      };

      const decision = await orchestrator.getRouterAgent().classify(input, orchestrator.listAgents());
      assert.strictEqual(decision.selectedAgentId, 'knowledge-agent');
      assert.ok(decision.confidence >= 0.75);
    });

    it('routes "Find information in project docs" to Knowledge Agent', async () => {
      const input: AgentInput = {
        userId: 'trainer_2',
        message: 'Find information in project docs about authentication.',
      };

      const decision = await orchestrator.getRouterAgent().classify(input, orchestrator.listAgents());
      assert.strictEqual(decision.selectedAgentId, 'knowledge-agent');
      assert.ok(decision.confidence >= 0.75);
    });

    it('routes "Summarize our last conversation" to Memory Agent', async () => {
      const input: AgentInput = {
        userId: 'trainer_3',
        message: 'Summarize our last conversation and what we talked about yesterday.',
      };

      const decision = await orchestrator.getRouterAgent().classify(input, orchestrator.listAgents());
      assert.strictEqual(decision.selectedAgentId, 'memory-agent');
      assert.ok(decision.confidence >= 0.75);
    });

    it('routes "Remember that my favorite Uma is Silence Suzuka" to Memory Agent', async () => {
      const input: AgentInput = {
        userId: 'trainer_4',
        message: 'Remember that my favorite Uma is Silence Suzuka.',
      };

      const decision = await orchestrator.getRouterAgent().classify(input, orchestrator.listAgents());
      assert.strictEqual(decision.selectedAgentId, 'memory-agent');
      assert.ok(decision.confidence >= 0.75);
    });

    it('routes "Who is top 10 on the circle leaderboard?" to Tool Agent', async () => {
      const input: AgentInput = {
        userId: 'trainer_5',
        message: 'Who is top 10 on the circle leaderboard and who has the most fans?',
      };

      const decision = await orchestrator.getRouterAgent().classify(input, orchestrator.listAgents());
      assert.strictEqual(decision.selectedAgentId, 'tool-agent');
      assert.ok(decision.confidence >= 0.75);
    });

    it('routes "Moderate this channel and review safety" to Moderation Agent', async () => {
      const input: AgentInput = {
        userId: 'trainer_6',
        message: 'Moderate this channel and check safety policies for harassment.',
      };

      const decision = await orchestrator.getRouterAgent().classify(input, orchestrator.listAgents());
      assert.strictEqual(decision.selectedAgentId, 'moderation-agent');
      assert.ok(decision.confidence >= 0.75);
    });

    it('recovers gracefully with fallback on unknown or ambiguous intent', async () => {
      const input: AgentInput = {
        userId: 'trainer_7',
        message: 'xyz abc completely ambiguous gibberish 12345',
      };

      mockAi.setCustomResponse('{"selectedAgentId": "chat", "confidence": 0.5, "reasoning": "Unclear input"}');
      const decision = await orchestrator.getRouterAgent().classify(input, orchestrator.listAgents());
      assert.ok(decision.selectedAgentId.length > 0);
      assert.strictEqual(decision.isFallback, true);
    });
  });

  describe('3. Agent Task Delegation & Context Sharing', () => {
    it('allows Knowledge Agent to delegate domain subtasks to Tool Agent', async () => {
      let toolAgentExecuted = false;

      // Mock tool agent execution
      const toolAgent = orchestrator.getAgent('tool-agent')!;
      toolAgent.execute = async (input, orch) => {
        toolAgentExecuted = true;
        return {
          agentId: 'tool-agent',
          agentName: 'Tool Agent',
          answer: 'Special Week current fan count: 2,450,000 fans (Rank #3)',
          status: 'completed',
          toolsUsed: ['get_trainer_stats'],
          durationMs: 25,
        };
      };

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content:
                    'According to documentation and live fan stats, Special Week currently has 2,450,000 fans.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const knowledgeAgent = orchestrator.getAgent('knowledge-agent')!;
      const output = await knowledgeAgent.execute(
        {
          userId: 'trainer_delegation_1',
          message: 'What does the documentation say about trainer stats for Special Week?',
        },
        orchestrator
      );

      assert.strictEqual(toolAgentExecuted, true, 'Knowledge agent should delegate to Tool agent');
      assert.strictEqual(output.status, 'completed');
      assert.ok(output.delegations && output.delegations.length >= 1);
      assert.strictEqual(output.delegations[0].toAgentId, 'tool-agent');
    });

    it('rejects cyclic delegation loops to prevent infinite recursions', async () => {
      const output = await orchestrator.delegate('knowledge-agent', 'knowledge-agent', {
        userId: 'trainer_cycle',
        message: 'Cyclic query',
        delegationChain: ['knowledge-agent'],
      });

      assert.strictEqual(output.status, 'failed');
      assert.match(output.error || '', /Cyclic delegation rejected/i);
    });

    it('enforces maximum delegation depth limit', async () => {
      const output = await orchestrator.delegate('tool-agent', 'knowledge-agent', {
        userId: 'trainer_depth',
        message: 'Deep query',
        delegationChain: ['router-agent', 'moderation-agent', 'memory-agent'],
        maxDelegations: 3,
      });

      assert.strictEqual(output.status, 'failed');
      assert.match(output.error || '', /Max delegation depth/i);
    });
  });

  describe('4. Multi-Step Workflow Execution Suite', () => {
    it('executes multi-step workflow: Document Retrieval -> Summarization -> Response', async () => {
      let callCount = 0;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        callCount++;

        // Step 1: Model calls search_knowledge
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_step_1',
                        type: 'function',
                        function: {
                          name: 'search_knowledge',
                          arguments: JSON.stringify({ query: 'deployment Cloud Run' }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Step 2: Model calls summarize_document
        if (callCount === 2) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_step_2',
                        type: 'function',
                        function: {
                          name: 'summarize_document',
                          arguments: JSON.stringify({
                            documentIdOrTitle: 'Cloud Run Deployment Architecture & Production Infrastructure',
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Step 3: Model returns final synthesized summary
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content:
                    'Summary of deployment docs: Umakraft runs on Google Cloud Run containers reverse-proxied by Nginx on Port 3000 with zero external ports exposed.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const output = await orchestrator.routeAndExecute({
        userId: 'trainer_multistep_1',
        message: 'Find deployment docs and summarize them.',
      });

      assert.strictEqual(output.status, 'completed');
      assert.strictEqual(output.agentId, 'knowledge-agent');
      assert.ok(output.toolsUsed.includes('search_knowledge'));
      assert.ok(output.toolsUsed.includes('summarize_document'));
      assert.match(output.answer, /Cloud Run|Port 3000|Nginx/i);
    });
  });

  describe('5. Moderation Agent & Safety Auditing', () => {
    it('evaluates message safety and writes audit record', async () => {
      mockAi.setCustomResponse(
        '### Moderation Assessment\n- **Safety Status**: Safe / Low Risk\n- **Policy Violations**: None\n- **Recommendation**: No action needed.'
      );

      const moderationAgent = orchestrator.getAgent('moderation-agent')!;
      const output = await moderationAgent.execute({
        userId: 'trainer_mod_1',
        channelId: 'channel-test-mod',
        message: 'Is it acceptable to discuss race factor optimization strategies here?',
      });

      assert.strictEqual(output.status, 'completed');
      assert.strictEqual(output.agentId, 'moderation-agent');
      assert.match(output.answer, /Moderation Assessment|Safe/i);
    });
  });

  describe('6. Discord Router Integration (routeMultiAgent)', () => {
    it('executes routeMultiAgent seamlessly', async () => {
      globalThis.fetch = (async (): Promise<Response> => {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Here is your conversation summary: We discussed Speed and Stamina training routines.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const output = await routeMultiAgent({
        userId: 'trainer_discord_route_1',
        message: 'Summarize our last conversation.',
      });

      assert.strictEqual(output.status, 'completed');
      assert.strictEqual(output.agentId, 'memory-agent');
      assert.match(output.answer, /conversation summary/i);
    });
  });
});
