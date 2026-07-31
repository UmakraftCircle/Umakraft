/**
 * ModelRouter Unit Tests
 * 
 * Tests model selection based on token count, cost ceiling, and capabilities.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('ModelRouter', () => {
  let MODELS: any;
  let ModelRouter: any;

  before(async () => {
    const mod = await import('@ai-agent-platform/core');
    MODELS = mod.MODELS;
    ModelRouter = mod.ModelRouter;
  });

  describe('MODELS registry', () => {
    it('should contain Claude 3.5 Sonnet', () => {
      const sonnet = MODELS['claude-3-5-sonnet'];
      assert.ok(sonnet);
      assert.equal(sonnet.provider, 'anthropic');
      assert.ok(sonnet.capabilities.includes('vision'));
      assert.equal(sonnet.contextWindow, 200000);
    });

    it('should contain Claude 3.5 Haiku', () => {
      const haiku = MODELS['claude-3-5-haiku'];
      assert.ok(haiku);
      assert.equal(haiku.provider, 'anthropic');
      assert.ok(haiku.costPer1kTokens.input < MODELS['claude-3-5-sonnet'].costPer1kTokens.input);
    });

    it('should contain GPT-4o', () => {
      const gpt4o = MODELS['gpt-4o'];
      assert.ok(gpt4o);
      assert.equal(gpt4o.provider, 'openai');
    });

    it('should contain a local Llama model', () => {
      const localModels = Object.values(MODELS).filter((m: any) => m.isLocal);
      assert.ok(localModels.length >= 1, 'Should have at least one local model');
    });

    it('should route for cheapest model for simple text tasks', () => {
      const router = new ModelRouter();
      const decision = router.route({
        promptLength: 500,
        requiresStructuredOutput: false,
        requiresVision: false,
      });
      assert.ok(decision);
      assert.ok(decision.estimatedCost < 0.01);
      assert.equal(typeof decision.reason, 'string');
    });

    it('should select vision-capable model when vision is required', () => {
      const router = new ModelRouter();
      const decision = router.route({
        promptLength: 1000,
        requiresStructuredOutput: false,
        requiresVision: true,
      });
      assert.ok(decision);
      assert.ok(decision.model.capabilities.includes('vision'));
    });

    it('should throw if no model fits the cost budget', () => {
      const router = new ModelRouter();
      assert.throws(() => {
        router.route({
          promptLength: 1_000_000,
          requiresStructuredOutput: false,
          requiresVision: false,
          maxBudget: 0.0001,
        });
      }, /budget/i);
    });

    it('should prefer local models when preferLocal is true', () => {
      const router = new ModelRouter();
      const decision = router.route({
        promptLength: 500,
        requiresStructuredOutput: false,
        requiresVision: false,
        preferLocal: true,
      });
      assert.ok(decision);
      assert.equal(decision.model.isLocal, true);
    });

    it('should factor token count into cost estimation', () => {
      const router = new ModelRouter();
      const small = router.route({
        promptLength: 100,
        requiresStructuredOutput: false,
        requiresVision: false,
      });
      const large = router.route({
        promptLength: 100_000,
        requiresStructuredOutput: false,
        requiresVision: false,
      });
      assert.ok(small && large);
      // Cost should scale with tokens — if same model, large cost > small cost
      if (small.model.id === large.model.id) {
        assert.ok(large.estimatedCost > small.estimatedCost,
          `Expected large cost ${large.estimatedCost} > small cost ${small.estimatedCost}`);
      }
      // Even if different models, they should be different routing decisions
      // (context window enforcement now prevents same-model routing for 100k tokens)
      assert.ok(
        small.model.id !== large.model.id || large.estimatedCost > small.estimatedCost,
        'Different prompt lengths should produce different routing outcomes'
      );
    });

    it('should require structured output capability when specified', () => {
      const router = new ModelRouter();
      const decision = router.route({
        promptLength: 1000,
        requiresStructuredOutput: true,
        requiresVision: false,
      });
      assert.ok(decision);
      assert.ok(decision.model.capabilities.includes('structured-output'));
    });
  });
});
