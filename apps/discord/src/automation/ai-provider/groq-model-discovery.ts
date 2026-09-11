import { createLogger } from '@ai-agent-platform/shared';
import { GroqKeyManager } from './groq-key-manager.js';

const logger = createLogger('GroqModelDiscovery');

export interface ModelDiscoveryReport {
  availableModels: string[];
  configuredModels: string[];
  rejectedModels: string[];
  cached: boolean;
  timestamp: number;
}

/**
 * GroqModelDiscoveryService
 * - Automatically queries `GET https://api.groq.com/openai/v1/models`
 * - Caches discovered models for 12 hours
 * - Validates and filters user-configured models against live models
 * - Prints startup diagnostics: Available, Configured, and Rejected models
 */
export class GroqModelDiscoveryService {
  private static instance: GroqModelDiscoveryService;
  private keyManager: GroqKeyManager;
  private availableModels: string[] = [];
  private lastFetchedAt = 0;
  private readonly cacheTtlMs = 12 * 60 * 60 * 1000; // 12 hours
  private refreshInterval: NodeJS.Timeout | null = null;

  // Curated candidate list if API is unreachable or before first sync
  private static readonly KNOWN_FALLBACK_CANDIDATES: string[] = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen-2.5-32b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
  ];

  constructor(keyManager?: GroqKeyManager) {
    this.keyManager = keyManager || new GroqKeyManager();
    // Schedule 12-hour periodic refresh
    this.refreshInterval = setInterval(() => {
      this.refreshAvailableModels().catch((err) => {
        logger.warn(`[GroqModelDiscoveryService] Background refresh failed: ${err?.message}`);
      });
    }, this.cacheTtlMs);
    if (this.refreshInterval.unref) {
      this.refreshInterval.unref();
    }
  }

  public static getInstance(keyManager?: GroqKeyManager): GroqModelDiscoveryService {
    if (!GroqModelDiscoveryService.instance) {
      GroqModelDiscoveryService.instance = new GroqModelDiscoveryService(keyManager);
    }
    return GroqModelDiscoveryService.instance;
  }

  /**
   * Fetches models list from Groq API endpoint.
   * Rotates through available keys if a key fails.
   */
  public async refreshAvailableModels(): Promise<string[]> {
    const keyStates = this.keyManager.getAllKeyStates();
    if (keyStates.length === 0) {
      logger.warn('[GroqModelDiscoveryService] No Groq API keys available to query models.');
      if (this.availableModels.length === 0) {
        this.availableModels = [...GroqModelDiscoveryService.KNOWN_FALLBACK_CANDIDATES];
      }
      return this.availableModels;
    }

    let lastError: Error | null = null;

    for (const keyState of keyStates) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch('https://api.groq.com/openai/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${keyState.key}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText.slice(0, 100)}`);
        }

        const data: any = await response.json();
        const modelList: string[] = (data?.data || [])
          .filter((m: any) => m.active !== false && typeof m.id === 'string')
          .map((m: any) => m.id.trim())
          .filter((id: string) => id.length > 0);

        if (modelList.length > 0) {
          this.availableModels = modelList;
          this.lastFetchedAt = Date.now();
          logger.info(
            `[GroqModelDiscoveryService] Discovered ${modelList.length} available models from Groq via Key ${keyState.keyIndex}.`
          );
          return this.availableModels;
        }
      } catch (err: any) {
        lastError = err;
        logger.warn(
          `[GroqModelDiscoveryService] Key ${keyState.keyIndex} failed to fetch models: ${err?.message}`
        );
      }
    }

    if (this.availableModels.length === 0) {
      logger.warn(
        `[GroqModelDiscoveryService] All keys failed model discovery (${lastError?.message}). Using known fallback candidates.`
      );
      this.availableModels = [...GroqModelDiscoveryService.KNOWN_FALLBACK_CANDIDATES];
    }

    return this.availableModels;
  }

  /**
   * Returns current available models list (from cache or fetched on demand).
   */
  public async getAvailableModels(): Promise<string[]> {
    const isStale = Date.now() - this.lastFetchedAt > this.cacheTtlMs;
    if (this.availableModels.length === 0 || isStale) {
      await this.refreshAvailableModels();
    }
    return [...this.availableModels];
  }

  /**
   * Synchronous accessor for currently cached models.
   */
  public getCachedAvailableModels(): string[] {
    if (this.availableModels.length === 0) {
      return [...GroqModelDiscoveryService.KNOWN_FALLBACK_CANDIDATES];
    }
    return [...this.availableModels];
  }

  /**
   * Validates configured models against discovered models.
   * Prints the required startup diagnostics.
   */
  public async validateConfiguredModels(configuredModels: string[]): Promise<ModelDiscoveryReport> {
    const available = await this.getAvailableModels();
    const availableSet = new Set(available.map((m) => m.toLowerCase()));

    const validated: string[] = [];
    const rejected: string[] = [];

    for (const model of configuredModels) {
      const lower = model.toLowerCase();
      if (availableSet.has(lower)) {
        // Find exact casing from available
        const matched = available.find((m) => m.toLowerCase() === lower) || model;
        validated.push(matched);
      } else {
        rejected.push(model);
      }
    }

    // Startup Diagnostics Output (Issue 7)
    logger.info('==================================================');
    logger.info('Available Groq Models:');
    for (const m of available) {
      logger.info(`- ${m}`);
    }
    logger.info('Configured Models:');
    for (const m of validated) {
      logger.info(`- ${m}`);
    }
    if (rejected.length > 0) {
      logger.warn('Rejected Models (Not available on Groq):');
      for (const m of rejected) {
        logger.warn(`- ${m}`);
      }
    } else {
      logger.info('Rejected Models: None');
    }
    logger.info('==================================================');

    return {
      availableModels: available,
      configuredModels: validated,
      rejectedModels: rejected,
      cached: this.lastFetchedAt > 0,
      timestamp: Date.now(),
    };
  }
}
