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
  strategy?: ModelStrategy;
}

/**
 * Task metadata sent by the Executor to request a model routing strategy.
 * Does not contain repository files or runtime state.
 */
export interface TaskMetadata {
  taskType?: 'planning' | 'coding' | 'validation' | 'general' | string;
  complexity?: 'low' | 'medium' | 'high';
  requiresTools?: boolean;
  estimatedTokens?: number;
  promptLength?: number;
  requiresStructuredOutput?: boolean;
  requiresVision?: boolean;
  maxBudget?: number;
  preferLocal?: boolean;
}

/**
 * Strategy object returned by the Model Router and followed by the Executor.
 */
export interface ModelStrategy {
  provider: 'openai' | 'anthropic' | 'ollama' | 'groq' | 'local' | string;
  model: string;
  temperature: number;
  maxTokens?: number;
  profile?: ModelProfile;
  reason?: string;
  estimatedCost?: number;
  metadata?: Record<string, any>;
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
   * Pure model routing strategy: given task metadata, returns the optimal ModelStrategy.
   * ModelRouter never executes prompts, loads repository files, accesses memory, or calls tools.
   */
  public getStrategy(metadata: TaskMetadata): ModelStrategy {
    const promptLength = metadata.promptLength ?? metadata.estimatedTokens ?? 500;
    const requiresTools = metadata.requiresTools ?? metadata.requiresStructuredOutput ?? false;
    const requiresVision = metadata.requiresVision ?? false;
    const taskType = (metadata.taskType || 'general').toLowerCase();
    const complexity = (
      metadata.complexity ||
      (taskType === 'planning' ? 'high' : taskType === 'validation' ? 'low' : 'medium')
    ).toLowerCase();

    // Filter candidates by capability constraints
    const candidates = Array.from(this.profiles.values()).filter((m) => {
      if (promptLength > m.contextWindow) return false;
      if (requiresTools && !m.capabilities.includes('structured-output')) return false;
      if (requiresVision && !m.capabilities.includes('vision')) return false;
      if (metadata.preferLocal && !m.isLocal) return false;
      return true;
    });

    if (candidates.length === 0) {
      throw new Error('No available model satisfies the routing constraints.');
    }

    // Rank candidates according to task needs
    const ranked = candidates
      .map((model) => {
        const estimatedTokens = Math.ceil(promptLength);
        const estimatedCost =
          (estimatedTokens / 1000) * model.costPer1kTokens.input +
          (estimatedTokens / 1000) * model.costPer1kTokens.output * 0.5;

        const meetsBudget = metadata.maxBudget === undefined || estimatedCost <= metadata.maxBudget;

        return { model, estimatedCost, meetsBudget };
      })
      .filter((r) => r.meetsBudget)
      .sort((a, b) => {
        // If preferLocal is true, local models take precedence. Otherwise, cloud models take precedence.
        if (metadata.preferLocal) {
          if (a.model.isLocal !== b.model.isLocal) {
            return a.model.isLocal ? -1 : 1;
          }
        } else {
          if (a.model.isLocal !== b.model.isLocal) {
            return a.model.isLocal ? 1 : -1;
          }
        }

        // Planning or high-complexity tasks favor high-capacity reasoning models
        if (taskType === 'planning' || complexity === 'high') {
          const aHighCap = a.model.capabilities.includes('code') && a.model.contextWindow >= 128000;
          const bHighCap = b.model.capabilities.includes('code') && b.model.contextWindow >= 128000;
          if (aHighCap !== bHighCap) return aHighCap ? -1 : 1;
        }

        return a.estimatedCost - b.estimatedCost;
      });

    if (ranked.length === 0) {
      throw new Error(`No model fits within the budget of $${metadata.maxBudget}.`);
    }

    const best = ranked[0];

    // Compute execution parameters based on task metadata
    let temperature = 0.7;
    let maxTokens = 2048;

    if (taskType === 'planning' || complexity === 'high') {
      temperature = 0.2;
      maxTokens = 4096;
    } else if (taskType === 'validation' || complexity === 'low') {
      temperature = 0.1;
      maxTokens = 2048;
    } else if (taskType === 'coding') {
      temperature = 0.2;
      maxTokens = 4096;
    }

    const strategy: ModelStrategy = {
      provider: best.model.provider,
      model: best.model.id,
      temperature,
      maxTokens,
      profile: best.model,
      reason: `Selected ${best.model.name} (${best.model.provider}) for ${complexity} complexity ${taskType} task.`,
      estimatedCost: best.estimatedCost,
      metadata: {
        taskType,
        complexity,
        requiresTools,
      },
    };

    logger.info(`Strategy derived: ${strategy.model} (${strategy.provider}) - temp: ${temperature}`);
    return strategy;
  }

  /**
   * Routes a request to the most cost-effective model that meets requirements.
   * Follows the platform principle: "Routing is about cost and capability, not preference."
   */
  public route(context: RoutingContext | TaskMetadata): RoutingDecision {
    const promptLength = context.promptLength ?? (context as TaskMetadata).estimatedTokens ?? 500;
    const requiresStructured =
      context.requiresStructuredOutput ?? (context as TaskMetadata).requiresTools ?? false;
    const requiresVision = context.requiresVision ?? false;
    const preferLocal = context.preferLocal ?? false;

    const candidates = Array.from(this.profiles.values()).filter((m) => {
      if (promptLength > m.contextWindow) return false;
      if (requiresStructured && !m.capabilities.includes('structured-output')) return false;
      if (requiresVision && !m.capabilities.includes('vision')) return false;
      if (preferLocal && !m.isLocal) return false;
      return true;
    });

    if (candidates.length === 0) {
      throw new Error('No available model satisfies the routing constraints.');
    }

    // Score and rank: lower cost = better, but prefer local if specified
    const ranked = candidates
      .map((model) => {
        const estimatedTokens = Math.ceil(promptLength);
        const estimatedCost =
          (estimatedTokens / 1000) * model.costPer1kTokens.input +
          (estimatedTokens / 1000) * model.costPer1kTokens.output * 0.5;

        const meetsBudget = context.maxBudget === undefined || estimatedCost <= context.maxBudget;

        return { model, estimatedCost, meetsBudget };
      })
      .filter((r) => r.meetsBudget)
      .sort((a, b) => {
        // Local models always win if preferred
        if (preferLocal && a.model.isLocal !== b.model.isLocal) {
          return a.model.isLocal ? -1 : 1;
        }
        return a.estimatedCost - b.estimatedCost;
      });

    if (ranked.length === 0) {
      throw new Error(`No model fits within the budget of $${context.maxBudget}.`);
    }

    const best = ranked[0];
    logger.info(`Routed to ${best.model.name} — estimated cost: $${best.estimatedCost.toFixed(4)}`);

    const reason = `Selected ${best.model.name} (${best.model.provider}): lowest cost meeting all capability requirements.`;

    const strategy: ModelStrategy = {
      provider: best.model.provider,
      model: best.model.id,
      temperature: 0.7,
      maxTokens: 2048,
      profile: best.model,
      reason,
      estimatedCost: best.estimatedCost,
    };

    return {
      model: best.model,
      estimatedCost: best.estimatedCost,
      reason,
      strategy,
    };
  }

  /**
   * Returns the list of all available model profiles for UI/schema introspection.
   */
  public getAvailableModels(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }
}
