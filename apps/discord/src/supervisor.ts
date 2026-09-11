import { TextChannel } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Supervisor');

const RETRY_DELAY_MS = 60 * 60 * 1000; // 60 minutes
const MAX_RETRIES = 3;
const BACKOFF_MULTIPLIER = 2;

interface RetryEntry {
  channel: TextChannel;
  message: string;
  context: string;
  scheduledAt: number;
  timer: NodeJS.Timeout;
  attempt: number;
}

/**
 * MessageSupervisor — wraps every Discord message send across all services.
 *
 * Retry policy:
 *   1. trySend() attempts channel.send()
 *   2. On failure → schedules retry after 60 minutes
 *   3. On retry failure → schedules up to 2 more retries with exponential backoff
 *      (60min → 120min → 240min = 3 total attempts)
 *   4. On retry success → logged as "recovered"
 *   5. On retry exhausted → logged as "permanent failure", discarded
 *
 * Channel references are stored directly (Discord.js caches them in-memory
 * for the process lifetime). Retries are lost on process restart — by design:
 * this is a best-effort safety net for transient Discord outages.
 */
export class MessageSupervisor {
  private pending = new Map<string, RetryEntry>();
  private stats = {
    attempted: 0,
    sent: 0,
    failed: 0,
    recovered: 0,
    permanentFailures: 0,
  };

  /**
   * Try to send a message. If it fails, schedule a 60-minute retry.
   * @returns true if sent now, false if failed (retry scheduled)
   */
  async trySend(
    channel: TextChannel,
    message: string,
    context: string,
  ): Promise<boolean> {
    this.stats.attempted++;

    try {
      await channel.send(message);
      this.stats.sent++;
      return true;
    } catch (err: any) {
      this.stats.failed++;
      logger.warn(
        `❌ Send FAILED [${context}] → scheduling 60min retry ` +
        `(#${channel.name} in ${channel.guild.name}): ${err.message}`,
      );
      this.#schedule(channel, message, context);
      return false;
    }
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  getStats() {
    return { ...this.stats, pending: this.pending.size };
  }

  /** Cancel all pending retries (call on shutdown). */
  cancelAll(): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
    }
    this.pending.clear();
    logger.info('All pending retries cancelled.');
  }

  // ── Private ─────────────────────────────────────────────

  #schedule(channel: TextChannel, message: string, context: string): void {
    const id = `${context}-${Date.now()}`;
    const delay = RETRY_DELAY_MS; // first retry: 60 min
    const timer = setTimeout(() => this.#executeRetry(id), delay);

    this.pending.set(id, { channel, message, context, scheduledAt: Date.now(), timer, attempt: 1 });

    const eta = new Date(Date.now() + delay).toLocaleTimeString();
    logger.info(`📋 Retry [${context}] scheduled for ${eta} (attempt 1, ${this.pending.size} pending)`);
  }

  async #executeRetry(id: string): Promise<void> {
    const entry = this.pending.get(id);
    if (!entry) return;

    // Remove from pending first to prevent double-fire
    clearTimeout(entry.timer);
    this.pending.delete(id);

    const elapsed = Math.round((Date.now() - entry.scheduledAt) / 1000);
    logger.info(`🔄 EXECUTING retry [${entry.context}] after ${elapsed}s...`);

    try {
      await entry.channel.send(entry.message);
      this.stats.recovered++;
      logger.info(`✅ Retry RECOVERED [${entry.context}] — message delivered!`);
    } catch (err: any) {
      // Exponential backoff: if under MAX_RETRIES, schedule again with longer delay
      const nextAttempt = entry.attempt + 1;
      if (nextAttempt <= MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, nextAttempt - 1);
        const id = `${entry.context}-retry${nextAttempt}-${Date.now()}`;
        const timer = setTimeout(() => this.#executeRetry(id), delay);

        this.pending.set(id, {
          channel: entry.channel,
          message: entry.message,
          context: entry.context,
          scheduledAt: Date.now(),
          timer,
          attempt: nextAttempt,
        });

        const eta = new Date(Date.now() + delay).toLocaleTimeString();
        logger.warn(
          `🔄 Scheduling retry attempt ${nextAttempt}/${MAX_RETRIES} ` +
          `[${entry.context}] for ${eta} (delay: ${Math.round(delay / 1000 / 60)}min)`,
        );
      } else {
        this.stats.permanentFailures++;
        logger.error(
          `💀 Retry EXHAUSTED [${entry.context}] — ${MAX_RETRIES} attempts, permanent failure: ${err.message}`,
        );
      }
    }
  }
}
