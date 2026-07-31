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
      db.prepare(
        `INSERT INTO learning_observations (task_id, task_name, tool_slug, error_message, timestamp, context)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(obs.taskId, obs.taskName, obs.toolSlug, obs.errorMessage, obs.timestamp, obs.context || null);
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
      const rows = db.prepare(
        `SELECT task_id, task_name, tool_slug, error_message, timestamp, context
         FROM learning_observations ORDER BY id DESC LIMIT 1000`
      ).all() as any[];

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
   * Get failure stats per tool — useful for targeted debugging.
   */
  public async getToolFailureStats(): Promise<Array<{ toolSlug: string; count: number; lastSeen: string }>> {
    try {
      const db = await getDatabase();
      const rows = db.prepare(
        `SELECT tool_slug, COUNT(*) as count, MAX(timestamp) as last_seen
         FROM learning_observations
         GROUP BY tool_slug
         ORDER BY count DESC`
      ).all() as any[];
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
      db.prepare(
        `INSERT INTO adaptation_rules (id, pattern, suggestion, tool_slug, last_error_message, fix_id, occurrences, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET
           occurrences = adaptation_rules.occurrences + 1,
           last_seen = excluded.last_seen,
           last_error_message = excluded.last_error_message`
      ).run(rule.id, rule.pattern, rule.suggestion, rule.toolSlug, rule.lastErrorMessage, rule.fixId || null, rule.lastSeen);
    } catch (err: any) {
      logger.error(`Failed to save rule: ${err.message}`);
    }
  }

  /**
   * Load all adaptation rules from disk, sorted by occurrence frequency.
   * Reconstructs autoFix functions from persisted fix_id values.
   */
  public async loadRules(): Promise<AdaptationRule[]> {
    try {
      const db = await getDatabase();
      const rows = db.prepare(
        `SELECT id, pattern, suggestion, tool_slug, last_error_message, fix_id, occurrences, last_seen
         FROM adaptation_rules ORDER BY occurrences DESC`
      ).all() as any[];

      return rows.map((r: any) => ({
        id: r.id,
        pattern: r.pattern,
        suggestion: r.suggestion,
        toolSlug: r.tool_slug || '',
        lastErrorMessage: r.last_error_message || '',
        fixId: r.fix_id || undefined,
        autoFix: r.fix_id ? reconstructAutoFix(r.fix_id) : undefined,
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
      db.prepare('DELETE FROM learning_observations').run();
      db.prepare('DELETE FROM adaptation_rules').run();
      logger.info('Memory store reset — all observations and rules cleared.');
    } catch (err: any) {
      logger.error(`Failed to reset memory store: ${err.message}`);
    }
  }
}

// ── AutoFix reconstruction ──────────────────────────────
// When rules are loaded from SQLite, autoFix functions must be
// reconstructed from their persisted fix_id. Add new fix types here.

function reconstructAutoFix(
  fixId: string
): ((args: Record<string, any>) => Record<string, any>) | undefined {
  switch (fixId) {
    case 'make-absolute-path':
      return (args: Record<string, any>) => {
        if (args['path'] && !args['path'].startsWith('/')) {
          return { ...args, path: '/' + args['path'] };
        }
        return args;
      };
    default:
      return undefined;
  }
}
