import { createLogger } from '@ai-agent-platform/shared';
import {
  getActionTier, isHighRisk, LifecycleMachine,
  RateLimitedExecutor, DEFAULT_RATE_LIMITS, type RateLimitConfig,
  type AgentLifecycle,
} from './automation.js';
import { confirmationStore } from './confirmation-store.js';

const logger = createLogger('ActionController');

const RETRYABLE = /rate.?limit|timeout|too many|429|503|temporaril|transient|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i;

function isRetryable(err: string): boolean {
  return RETRYABLE.test(err);
}

/** Sleep with exponential backoff + jitter. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function backoff(attempt: number, baseMs = 200, maxMs = 10_000): number {
  return Math.min(baseMs * Math.pow(2, attempt) + Math.random() * baseMs * 0.3, maxMs);
}

/**
 * Feature 5.4/5.8/5.9: the ONLY path by which an autonomous action executes.
 *
 * - Permission enforcement: high-risk actions never run without a confirmed
 *   (single-use, user-bound, unexpired) confirmation.
 * - Rate/resource enforcement: per-user / per-guild / global / concurrency.
 * - Failure recovery: bounded retries with exponential backoff.
 *
 * The model can never call this controller directly to grant itself
 * permission — high-risk execution is gated on a separately-issued, consumed
 * confirmation token.
 */
export class ActionController {
  constructor(
    private limiter: RateLimitedExecutor = new RateLimitedExecutor(DEFAULT_RATE_LIMITS),
    private limits: RateLimitConfig = DEFAULT_RATE_LIMITS,
  ) {}

  get concurrency(): number { return this.limiter.concurrency; }

  /**
   * Execute an action. Returns an outcome. High-risk actions without a valid
   * confirmation are rejected.
   */
  async execute<T>(args: {
    slug: string;
    userId: string;
    guildId?: string | null;
    action: () => Promise<T>;
    /** For high-risk actions, a confirmation id the user approved. */
    confirmationId?: string;
    maxRetries?: number;
  }): Promise<{ ok: boolean; result?: T; reason?: string; lifecycle: AgentLifecycle }> {
    const tier = getActionTier(args.slug);
    const lifecycle = new LifecycleMachine('CREATED');
    lifecycle.transition('QUEUED');

    if (!tier) {
      lifecycle.transition('FAILED');
      return { ok: false, reason: `Unknown action slug: ${args.slug}`, lifecycle: lifecycle.current };
    }

    // Global rate limit
    if (!this.limiter.allowGlobal()) {
      lifecycle.transition('FAILED');
      return { ok: false, reason: 'global rate limit exceeded', lifecycle: lifecycle.current };
    }
    // Per-user rate limit
    if (!this.limiter.allowUser(args.userId)) {
      lifecycle.transition('FAILED');
      return { ok: false, reason: 'per-user rate limit exceeded', lifecycle: lifecycle.current };
    }
    // Per-guild rate limit
    if (args.guildId && !this.limiter.allowGuild(args.guildId)) {
      lifecycle.transition('FAILED');
      return { ok: false, reason: 'per-guild rate limit exceeded', lifecycle: lifecycle.current };
    }

    // High-risk: require a valid, consumed confirmation
    if (isHighRisk(args.slug)) {
      if (!args.confirmationId) {
        lifecycle.transition('WAITING_FOR_CONFIRMATION');
        return { ok: false, reason: 'high-risk action requires confirmation', lifecycle: lifecycle.current };
      }
      const conf = await confirmationStore.consume(args.confirmationId, args.userId);
      if (!conf.ok) {
        lifecycle.transition('EXPIRED');
        return { ok: false, reason: `confirmation ${conf.reason}`, lifecycle: lifecycle.current };
      }
    }

    // Concurrency control
    let release: (() => void) | null = null;
    try {
      release = await this.limiter.acquireConcurrency();
    } catch (err: any) {
      lifecycle.transition('FAILED');
      return { ok: false, reason: err?.message ?? 'concurrency limit reached', lifecycle: lifecycle.current };
    }

    lifecycle.transition('RUNNING');

    // Execute with bounded retry + exponential backoff
    const maxRetries = args.maxRetries ?? 3;
    let lastErr = '';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await args.action();
        lifecycle.transition('COMPLETED');
        return { ok: true, result, lifecycle: lifecycle.current };
      } catch (err: any) {
        lastErr = err?.message ?? String(err);
        logger.warn(`action ${args.slug} attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastErr}`);
        if (!isRetryable(lastErr)) break;
        if (attempt < maxRetries) {
          await sleep(backoff(attempt));
        }
      }
    }

    lifecycle.transition('FAILED');
    return { ok: false, reason: lastErr || 'action failed', lifecycle: lifecycle.current };
  }
}
