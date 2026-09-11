import { createLogger } from '@ai-agent-platform/shared';
import { GroqModelDiscoveryService } from './groq-model-discovery.js';
import { ModelHealthManager } from './model-health-manager.js';

const logger = createLogger('GroqModelManager');

export interface ModelRoutingContext {
  intent?: string;
  messageLength?: number;
}

/**
 * GroqModelManager — Dynamic model pool, health monitoring, and intelligent routing.
 * - Auto-validates against GroqModelDiscoveryService (groq.models.list).
 * - Excludes circuit-broken models via ModelHealthManager.
 * - Dynamically routes between Fast Chat, Complex Questions, Large Context, and Fallback.
 */
export class GroqModelManager {
  private discoveryService: GroqModelDiscoveryService;
  private healthManager: ModelHealthManager;

  // Curated candidate priority chain (including proven working models)
  private defaultCandidatePool: string[] = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-safeguard-20b',
    'qwen/qwen3.6-27b',
    'mixtral-8x7b-32768',
    'allam-2-7b',
  ];

  private configuredModels: string[] = [];

  constructor(discoveryService?: GroqModelDiscoveryService, healthManager?: ModelHealthManager) {
    this.discoveryService = discoveryService || GroqModelDiscoveryService.getInstance();
    this.healthManager = healthManager || ModelHealthManager.getInstance();
    this.loadModels();
  }

  private normalizeModelName(raw: string): string {
    const trimmed = raw.trim().toLowerCase();
    // Normalize aliases & variations
    if (trimmed.includes('gpt-oss-120b')) return 'openai/gpt-oss-120b';
    if (trimmed.includes('safeguard')) return 'openai/gpt-oss-safeguard-20b';
    if (trimmed.includes('qwen')) return 'qwen/qwen3.6-27b';
    if (trimmed.includes('mixtral')) return 'mixtral-8x7b-32768';
    if (trimmed.includes('allam')) return 'allam-2-7b';
    return raw.trim();
  }

  public loadModels(): void {
    const rawEnv =
      process.env.AI_MODEL_PRIORITY ||
      process.env.GROQ_MODELS ||
      process.env.GROQ_MODEL ||
      process.env.AI_MODEL;

    if (rawEnv && rawEnv.trim().length > 0) {
      const parsed = rawEnv
        .split(/[\n,;]+/)
        .map((m) => this.normalizeModelName(m))
        .filter((m) => m.length > 0);
      if (parsed.length > 0) {
        this.configuredModels = Array.from(new Set(parsed));
      }
    }

    if (this.configuredModels.length === 0) {
      this.configuredModels = [...this.defaultCandidatePool];
    } else {
      // Append fallback pool to user configured models so a full chain is always available
      for (const fallback of this.defaultCandidatePool) {
        if (!this.configuredModels.includes(fallback)) {
          this.configuredModels.push(fallback);
        }
      }
    }

    logger.info(
      `[GroqModelManager] Configured model priority chain: [${this.configuredModels.join(', ')}]`
    );

    // Asynchronously validate against Groq API and print startup diagnostics (Issue 1 & 7)
    this.discoveryService
      .validateConfiguredModels(this.configuredModels)
      .catch((err) => {
        logger.warn(`[GroqModelManager] Startup model validation warning: ${err?.message}`);
      });
  }

  /**
   * Intelligent Model Routing (Issue 8):
   * - Fast Chat -> gpt-oss-20b, llama-3.1-8b-instant
   * - Complex Questions -> gpt-oss-120b, llama-3.3-70b-versatile
   * - Large Context -> qwen-2.5-32b, mixtral-8x7b-32768
   * - Fallback -> any healthy discovered model
   */
  public getPrioritizedModels(context?: ModelRoutingContext): string[] {
    const discovered = this.discoveryService.getCachedAvailableModels();
    const discoveredLower = new Set(discovered.map((m) => m.toLowerCase()));

    // Filter models: must be in discovered list (if discovery completed)
    let candidateList = this.configuredModels.filter((m) => {
      if (discoveredLower.size === 0) return true;
      return discoveredLower.has(m.toLowerCase());
    });

    if (candidateList.length === 0) {
      // Fallback to all discovered models
      candidateList = discovered.length > 0 ? [...discovered] : [...this.defaultCandidatePool];
    }

    // Filter by circuit breaker health (Issue 4)
    const healthyList = candidateList.filter((m) => this.healthManager.isModelHealthy(m));
    const activePool = healthyList.length > 0 ? healthyList : candidateList;

    // Intelligent Routing logic (Issue 8)
    const intent = context?.intent || '';
    const msgLen = context?.messageLength ?? 0;

    const isComplex =
      intent === 'RepositoryQuestion' ||
      intent === 'GoalAnalysis' ||
      intent === 'DeficitRecovery' ||
      msgLen > 250;

    const isFast = intent === 'Greeting' || (msgLen > 0 && msgLen < 100);

    const isLargeContext = msgLen > 1500 || intent.includes('Handbook');

    const prioritized: string[] = [];

    const addModelIfHealthy = (targetPattern: string) => {
      const match = activePool.find(
        (m) => m.toLowerCase().includes(targetPattern.toLowerCase()) && !prioritized.includes(m)
      );
      if (match) prioritized.push(match);
    };

    if (isComplex) {
      // Prioritize deep reasoning models
      addModelIfHealthy('gpt-oss-120b');
      addModelIfHealthy('llama-3.3-70b');
      addModelIfHealthy('qwen');
    } else if (isLargeContext) {
      // Prioritize large context models
      addModelIfHealthy('qwen');
      addModelIfHealthy('mixtral');
      addModelIfHealthy('gpt-oss-120b');
    } else if (isFast) {
      // Prioritize fast chat models
      addModelIfHealthy('gpt-oss-20b');
      addModelIfHealthy('llama-3.1-8b');
      addModelIfHealthy('kimi');
    }

    // Append remaining healthy models to guarantee a full fallback chain
    for (const m of activePool) {
      if (!prioritized.includes(m)) {
        prioritized.push(m);
      }
    }

    return prioritized;
  }
}

