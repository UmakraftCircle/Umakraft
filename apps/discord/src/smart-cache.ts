import { createLogger } from '@ai-agent-platform/shared';
import { IntentType } from './intent-router.js';

const logger = createLogger('SmartCacheService');

export interface CacheEntry<T = any> {
  key: string;
  intent: IntentType;
  data: T;
  createdAt: number;
  expiresAt: number;
  trainerId?: string;
}

export interface CacheMetrics {
  cacheHit: number;
  cacheMiss: number;
  cacheRejected: number;
  intentMismatch: number;
  similarityRejected: number;
}

export class SmartCacheService {
  private static instance: SmartCacheService;
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: CacheMetrics = {
    cacheHit: 0,
    cacheMiss: 0,
    cacheRejected: 0,
    intentMismatch: 0,
    similarityRejected: 0,
  };

  public static getInstance(): SmartCacheService {
    if (!SmartCacheService.instance) {
      SmartCacheService.instance = new SmartCacheService();
    }
    return SmartCacheService.instance;
  }

  /**
  * Generates an intent-aware and optionally trainer-scoped cache key.
  */
  private generateKey(intent: IntentType, normalizedQuery: string, trainerId?: string): string {
    const scope = trainerId && [IntentType.FAN_SYSTEM, IntentType.LEADERBOARD].includes(intent) ? `${trainerId}:` : '';
    return `${scope}${intent}:${normalizedQuery.toLowerCase().replace(/\s+/g, '_')}`;
  }

  /**
  * Gets TTL in milliseconds based on intent category.
  */
  private getTTL(intent: IntentType): number {
    switch (intent) {
      case IntentType.HANDBOOK:
        return 24 * 60 * 60 * 1000; // 24 hours
      case IntentType.LEADERBOARD:
        return 5 * 60 * 1000; // 5 minutes
      case IntentType.FAN_SYSTEM:
        return 1 * 60 * 1000; // 1 minute
      case IntentType.WEB_SEARCH:
        return 60 * 60 * 1000; // 1 hour
      case IntentType.CHAT:
      default:
        return 0; // Never cache conversational chat!
    }
  }

  /**
  * Retrieves cached data with intent validation, TTL expiration check, and similarity threshold.
  */
  public get(options: {
    intent: IntentType;
    query: string;
    trainerId?: string;
    similarity?: number;
  }): any | null {
    const { intent, query, trainerId, similarity = 0.90 } = options;

    // Never cache CHAT intents
    if (intent === IntentType.CHAT || intent === IntentType.UNKNOWN) {
      this.metrics.cacheMiss++;
      return null;
    }

    // Similarity threshold check (must be >= 0.85)
    if (similarity < 0.85) {
      this.metrics.similarityRejected++;
      logger.info(`[CACHE] Intent=${intent} Result=REJECTED Reason=SimilarityRejected (${similarity} < 0.85)`);
      return null;
    }

    const key = this.generateKey(intent, query, trainerId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.cacheMiss++;
      return null;
    }

    // Intent Mismatch Check
    if (entry.intent !== intent) {
      this.metrics.intentMismatch++;
      this.metrics.cacheRejected++;
      logger.warn(`[CACHE] Intent=${intent} CachedIntent=${entry.intent} Result=REJECTED Reason=IntentMismatch`);
      return null;
    }

    // Expiration check
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.metrics.cacheMiss++;
      return null;
    }

    this.metrics.cacheHit++;
    logger.info(`[CACHE] Intent=${intent} Result=HIT Key=${key}`);
    return entry.data;
  }

  /**
  * Stores data in cache respecting TTL rules and trainer scoping.
  */
  public put(options: {
    intent: IntentType;
    query: string;
    data: any;
    trainerId?: string;
  }): void {
    const { intent, query, data, trainerId } = options;
    const ttl = this.getTTL(intent);

    // If TTL is 0 (e.g. CHAT), do not store
    if (ttl <= 0) return;

    const key = this.generateKey(intent, query, trainerId);
    const now = Date.now();

    const entry: CacheEntry = {
      key,
      intent,
      data,
      createdAt: now,
      expiresAt: now + ttl,
      trainerId,
    };

    this.cache.set(key, entry);
    logger.info(`[CACHE] Stored Intent=${intent} Key=${key} TTL=${ttl}ms`);
  }

  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  public clear(): void {
    this.cache.clear();
    this.metrics = {
      cacheHit: 0,
      cacheMiss: 0,
      cacheRejected: 0,
      intentMismatch: 0,
      similarityRejected: 0,
    };
  }
}

export const smartCacheService = SmartCacheService.getInstance();
