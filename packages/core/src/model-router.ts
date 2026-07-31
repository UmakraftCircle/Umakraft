import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ModelRouter');

export interface ModelProfile {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'ollama';
  costPer1kTokens: { input: number; output: number };
  contextWindow: number;
  capabilities: ('text' | 'structured-output' | 'vision' | 'code')[];
  isLocal: boolean;
}

export interface RoutingDecision {
  model: ModelProfile;
  estimatedCost: number;
  reason: string;
}

/**
 * Pre-configured model profiles with current pricing (as of 2026).
 */
export const MODELS: Record<string, ModelProfile> = {
  'claude-3-5-sonnet': {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    costPer1kTokens: { input: 0.003, output: 0.015 },
    contextWindow: 200000,
    capabilities: ['text', 'structured-output', 'vision', 'code'],
    isLocal: false
  },
  'claude-3-5-haiku': {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    costPer1kTokens: { input: 0.0008, output: 0.004 },
    contextWindow: 200000,
    capabilities: ['text', 'structured-output'],
    isLocal: false
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    costPer1kTokens: { input: 0.0025, output: 0.01 },
    contextWindow: 128000,
    capabilities: ['text', 'structured-output', 'vision', 'code'],
    isLocal: false
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    costPer1kTokens: { input: 0.00015, output: 0.0006 },
    contextWindow: 128000,
    capabilities: ['text', 'structured-output'],
    isLocal: false
  },
  'ollama-llama3.1': {
    id: 'ollama-llama3.1',
    name: 'Llama 3.1 (Local via Ollama)',
    provider: 'ollama',
    costPer1kTokens: { input: 0, output: 0 },
    contextWindow: 128000,
    capabilities: ['text', 'code'],
    isLocal: true
  }
};

export interface RoutingContext {
  promptLength: number;       // estimated tokens
  requiresStructuredOutput: boolean;
  requiresVision: boolean;
  maxBudget?: number;         // max USD for this call
  preferLocal?: boolean;
}

export class ModelRouter {
  private profiles: Map<string, ModelProfile> = new Map();

  constructor(customModels?: ModelProfile[]) {
    // Load default profiles
    for (const profile of Object.values(MODELS)) {
      this.profiles.set(profile.id, profile);
    }
    // Override/add custom profiles
    if (customModels) {
      for (const profile of customModels) {
        this.profiles.set(profile.id, profile);
      }
    }
  }

  /**
   * Routes a request to the most cost-effective model that meets requirements.
   * Follows the platform principle: "Routing is about cost and capability, not preference."
   */
  public route(context: RoutingContext): RoutingDecision {
    const candidates = Array.from(this.profiles.values())
      .filter(m => {
        if (context.promptLength > m.contextWindow) return false;
        if (context.requiresStructuredOutput && !m.capabilities.includes('structured-output')) return false;
        if (context.requiresVision && !m.capabilities.includes('vision')) return false;
        if (context.preferLocal && !m.isLocal) return false;
        return true;
      });

    if (candidates.length === 0) {
      throw new Error('No available model satisfies the routing constraints.');
    }

    // Score and rank: lower cost = better, but prefer local if specified
    const ranked = candidates.map(model => {
      const estimatedTokens = Math.ceil(context.promptLength);
      const estimatedCost = (estimatedTokens / 1000) * model.costPer1kTokens.input +
                            (estimatedTokens / 1000) * model.costPer1kTokens.output * 0.5;

      const meetsBudget = context.maxBudget === undefined || estimatedCost <= context.maxBudget;

      return { model, estimatedCost, meetsBudget };
    })
    .filter(r => r.meetsBudget)
    .sort((a, b) => {
      // Local models always win if preferred
      if (context.preferLocal && a.model.isLocal !== b.model.isLocal) {
        return a.model.isLocal ? -1 : 1;
      }
      return a.estimatedCost - b.estimatedCost;
    });

    if (ranked.length === 0) {
      throw new Error(`No model fits within the budget of $${context.maxBudget}.`);
    }

    const best = ranked[0];
    logger.info(`Routed to ${best.model.name} — estimated cost: $${best.estimatedCost.toFixed(4)}`);

    return {
      model: best.model,
      estimatedCost: best.estimatedCost,
      reason: `Selected ${best.model.name} (${best.model.provider}): lowest cost meeting all capability requirements.`
    };
  }

  /**
   * Returns the list of all available model profiles for UI/schema introspection.
   */
  public getAvailableModels(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }
}
