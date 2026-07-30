import { createLogger } from '@ai-agent-platform/shared';
import { getDatabase } from '@ai-agent-platform/integrations';
import type { FailureObservation, AdaptationRule } from './learning.js';

const logger = createLogger('MemoryStore');

/**
 * Persistent Memory Store backed by SQLite.
 * 
 * Survives process restarts — the Learning Engine's observations and
 * adaptation rules persist across deployments so lessons are never lost.
 */
export class MemoryStore {
  private static instance: MemoryStore;

  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  private constructor() {}

  // ── Failure Observations ──

  /**
   * Persist a failure observation to durable storage.
   */
  public async saveObservation(obs: FailureObservation): Promise<void> {
    try {
      const db = await getDatabase();
      await new Promise<void>((resolve, reject) => {
        const stmt = db.prepare(
          `INSERT INTO learning_observations (task_id, task_name, tool_slug, error_message, timestamp, context)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        stmt.run(obs.taskId, obs.taskName, obs.toolSlug, obs.errorMessage, obs.timestamp, obs.context || null,
          (err: Error | null) => {
            stmt.finalize();
            if (err) return reject(err);
            resolve();
          }
        );
      });
      logger.debug(`Saved observation for task [${obs.taskId}]`);
    } catch (err: any) {
      logger.error(`Failed to save observation: ${err.message}`);
    }
  }

  /**
   * Load all failure observations from disk.
   */
  public async loadObservations(): Promise<FailureObservation[]> {
    try {
      const db = await getDatabase();
      const rows = await new Promise<any[]>((resolve, reject) => {
        db.all(
          // Latest 1000 observations — sufficient for pattern analysis.
          // Historical data beyond this window is retained in the DB for
          // direct SQL queries but not loaded into the engine at startup.
          `SELECT task_id, task_name, tool_slug, error_message, timestamp, context
           FROM learning_observations ORDER BY id DESC LIMIT 1000`,
          (err: Error | null, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        );
      });

      return rows.map((r: any) => ({
        taskId: r.task_id,
        taskName: r.task_name,
        toolSlug: r.tool_slug,
        errorMessage: r.error_message,
        timestamp: r.timestamp,
        context: r.context || undefined
      }));
    } catch (err: any) {
      logger.error(`Failed to load observations: ${err.message}`);
      return [];
    }
  }

  /**
   * Get failure stats for a specific tool — useful for targeted debugging.
   */
  public async getToolFailureStats(): Promise<Array<{ toolSlug: string; count: number; lastSeen: string }>> {
    try {
      const db = await getDatabase();
      const rows = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT tool_slug, COUNT(*) as count, MAX(timestamp) as last_seen
           FROM learning_observations
           GROUP BY tool_slug
           ORDER BY count DESC`,
          (err: Error | null, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        );
      });
      return rows.map((r: any) => ({
        toolSlug: r.tool_slug,
        count: r.count,
        lastSeen: r.last_seen
      }));
    } catch (err: any) {
      logger.error(`Failed to get tool failure stats: ${err.message}`);
      return [];
    }
  }

  // ── Adaptation Rules ──

  /**
   * Persist an adaptation rule (upsert — increment occurrences if exists).
   */
  public async saveRule(rule: AdaptationRule): Promise<void> {
    try {
      const db = await getDatabase();
      await new Promise<void>((resolve, reject) => {
        const stmt = db.prepare(
          `INSERT INTO adaptation_rules (id, pattern, suggestion, occurrences, last_seen)
           VALUES (?, ?, ?, 1, ?)
           ON CONFLICT(id) DO UPDATE SET
             occurrences = adaptation_rules.occurrences + 1,
             last_seen = excluded.last_seen`
        );
        stmt.run(rule.id, rule.pattern, rule.suggestion, rule.occurrences, rule.lastSeen,
          (err: Error | null) => {
            stmt.finalize();
            if (err) return reject(err);
            resolve();
          }
        );
      });
    } catch (err: any) {
      logger.error(`Failed to save rule: ${err.message}`);
    }
  }

  /**
   * Load all adaptation rules from disk, sorted by occurrence frequency.
   */
  public async loadRules(): Promise<AdaptationRule[]> {
    try {
      const db = await getDatabase();
      const rows = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT id, pattern, suggestion, occurrences, last_seen
           FROM adaptation_rules ORDER BY occurrences DESC`,
          (err: Error | null, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        );
      });

      return rows.map((r: any) => ({
        id: r.id,
        pattern: r.pattern,
        suggestion: r.suggestion,
        occurrences: r.occurrences,
        lastSeen: r.last_seen
      }));
    } catch (err: any) {
      logger.error(`Failed to load rules: ${err.message}`);
      return [];
    }
  }

  /**
   * Load the complete system memory: observations + rules.
   * Called once during LearningEngine initialization.
   */
  public async loadAll(): Promise<{ observations: FailureObservation[]; rules: AdaptationRule[] }> {
    const [observations, rules] = await Promise.all([
      this.loadObservations(),
      this.loadRules()
    ]);

    logger.info(`Loaded ${observations.length} observations and ${rules.length} adaptation rules from persistent memory.`);
    return { observations, rules };
  }

  /**
   * Purge all learning data (useful for resetting during development).
   */
  public async reset(): Promise<void> {
    try {
      const db = await getDatabase();
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('DELETE FROM learning_observations');
          db.run('DELETE FROM adaptation_rules', (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
      logger.info('Memory store reset — all observations and rules cleared.');
    } catch (err: any) {
      logger.error(`Failed to reset memory store: ${err.message}`);
    }
  }
}
