import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ModelRouter, TaskMetadata, ModelStrategy } from '../../packages/core/src/model-router.js';
import { ExecutorLayer } from '../../packages/core/src/layers/executor-layer.js';
import {
  AIProviderAdapter,
  NormalizedResponse,
  ProviderAdapter,
  AdapterRequest,
} from '../../packages/ai/src/index.js';
import { AgentTask } from '@ai-agent-platform/shared';

describe('Phase 5: Intelligent Model Routing & Executor Layer', () => {
  describe('ModelRouter.getStrategy()', () => {
    const router = new ModelRouter();

    it('returns a ModelStrategy object given task metadata only', () => {
      const metadata: TaskMetadata = {
        taskType: 'general',
        complexity: 'medium',
        requiresTools: false,
        estimatedTokens: 500,
      };

      const strategy: ModelStrategy = router.getStrategy(metadata);

      assert.ok(strategy, 'Strategy should be defined');
      assert.ok(strategy.provider, 'Strategy should define provider');
      assert.ok(strategy.model, 'Strategy should define model');
      assert.strictEqual(typeof strategy.temperature, 'number');
      assert.strictEqual(typeof strategy.maxTokens, 'number');
    });

    it('routes planning / high complexity tasks to reasoning models with lower temperature', () => {
      const metadata: TaskMetadata = {
        taskType: 'planning',
        complexity: 'high',
        requiresTools: true,
        estimatedTokens: 2500,
      };

      const strategy: ModelStrategy = router.getStrategy(metadata);

      assert.strictEqual(strategy.temperature, 0.2);
      assert.strictEqual(strategy.maxTokens, 4096);
      // High complexity planning routes to a top-tier reasoning model
      assert.ok(
        strategy.model === 'claude-3-5-sonnet' || strategy.model === 'gpt-4o',
        `Expected reasoning model, got ${strategy.model}`
      );
    });

    it('routes validation / low complexity tasks to fast cost-effective models with 0.1 temperature', () => {
      const metadata: TaskMetadata = {
        taskType: 'validation',
        complexity: 'low',
        requiresTools: false,
        estimatedTokens: 200,
      };

      const strategy: ModelStrategy = router.getStrategy(metadata);

      assert.strictEqual(strategy.temperature, 0.1);
      assert.strictEqual(strategy.maxTokens, 2048);
      assert.ok(
        strategy.model === 'gpt-4o-mini' || strategy.model === 'claude-3-5-haiku',
        `Expected lightweight model, got ${strategy.model}`
      );
    });

    it('honors preferLocal flag', () => {
      const metadata: TaskMetadata = {
        taskType: 'general',
        preferLocal: true,
      };

      const strategy: ModelStrategy = router.getStrategy(metadata);
      assert.strictEqual(strategy.provider, 'ollama');
      assert.strictEqual(strategy.model, 'ollama-llama3.1');
    });
  });

  describe('AIProviderAdapter & Response Normalization', () => {
    it('normalizes provider responses into Unified NormalizedResponse format', async () => {
      const adapter = new AIProviderAdapter();

      const strategy: ModelStrategy = {
        provider: 'mock',
        model: 'mock-test-model',
        temperature: 0.5,
        maxTokens: 1000,
      };

      const response: NormalizedResponse = await adapter.execute({
        strategy,
        prompt: 'Generate an analysis report',
      });

      assert.strictEqual(typeof response.content, 'string');
      assert.strictEqual(response.model, 'mock-test-model');
      assert.strictEqual(response.provider, 'mock');
      assert.ok(response.usage);
      assert.strictEqual(typeof response.usage.totalTokens, 'number');
      assert.strictEqual(response.finishReason, 'stop');
    });

    it('supports streaming callback during execution', async () => {
      const adapter = new AIProviderAdapter();
      const streamedTokens: string[] = [];

      const strategy: ModelStrategy = {
        provider: 'mock',
        model: 'mock-stream-model',
        temperature: 0.7,
      };

      const response = await adapter.execute({
        strategy,
        prompt: 'Stream this test',
        streaming: true,
        onToken: (tok) => streamedTokens.push(tok),
      });

      assert.ok(streamedTokens.length > 0, 'Tokens should have been streamed');
      assert.ok(response.content.length > 0);
    });

    it('supports custom provider registration without exposing provider details to executor', async () => {
      const customAdapter: ProviderAdapter = {
        async execute(req: AdapterRequest): Promise<NormalizedResponse> {
          return {
            content: `Custom response for: ${req.prompt}`,
            model: req.strategy.model,
            provider: 'custom-ai',
            finishReason: 'stop',
          };
        },
      };

      const adapter = new AIProviderAdapter();
      adapter.registerAdapter('custom-ai', customAdapter);

      const response = await adapter.execute({
        strategy: {
          provider: 'custom-ai',
          model: 'custom-model-v1',
          temperature: 0.2,
        },
        prompt: 'Custom test',
      });

      assert.strictEqual(response.provider, 'custom-ai');
      assert.strictEqual(response.content, 'Custom response for: Custom test');
    });
  });

  describe('ExecutorLayer Execution Flow', () => {
    it('follows the 5-step flow: receive task -> request strategy -> execute via adapter -> normalize -> return', async () => {
      let routerCalled = false;
      let adapterCalled = false;

      const router = new ModelRouter();
      const originalGetStrategy = router.getStrategy.bind(router);
      router.getStrategy = (metadata: TaskMetadata) => {
        routerCalled = true;
        assert.ok(metadata.taskType);
        assert.ok(metadata.complexity);
        return originalGetStrategy(metadata);
      };

      const mockAdapter: ProviderAdapter = {
        async execute(req: AdapterRequest): Promise<NormalizedResponse> {
          adapterCalled = true;
          return {
            content: 'Task executed successfully',
            structured: { status: 'done', count: 42 },
            model: req.strategy.model,
            provider: req.strategy.provider,
            finishReason: 'stop',
          };
        },
      };

      const aiAdapter = new AIProviderAdapter();
      aiAdapter.registerAdapter('openai', mockAdapter);
      aiAdapter.registerAdapter('anthropic', mockAdapter);

      const executor = new ExecutorLayer({
        modelRouter: router,
        aiAdapter,
      });

      const task: AgentTask = {
        id: 'task-101',
        name: 'Validate training dataset integrity',
        toolSlug: 'validator',
        arguments: { dataset: 'sample.json' },
        dependencies: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
      };

      const result = await executor.execute(task);

      assert.strictEqual(routerCalled, true, 'ModelRouter must be consulted for strategy');
      assert.strictEqual(adapterCalled, true, 'AIProviderAdapter must be called');
      assert.strictEqual(result.content, 'Task executed successfully');
      assert.deepStrictEqual(result.structured, { status: 'done', count: 42 });
    });

    it('executeTask wraps execution into standard TaskExecutionResult', async () => {
      const executor = new ExecutorLayer();

      const task: AgentTask = {
        id: 'task-102',
        name: 'Plan race strategy for Tokyo 2400m',
        toolSlug: 'planner',
        arguments: { race: 'Japan Cup' },
        dependencies: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      };

      const result = await executor.executeTask(task);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts, 1);
      assert.ok(result.response);
      assert.strictEqual(typeof result.data, 'string');
    });
  });
});
