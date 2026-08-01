import { createLogger } from '@ai-agent-platform/shared';
import * as crypto from 'crypto';

const logger = createLogger('Learning');

export interface FailureObservation {
  taskId: string;
  taskName: string;
  toolSlug: string;
  errorMessage: string;
  timestamp: string;
  context?: string;
}

export interface AdaptationRule {
  id: string;
  pattern: string;            // regex to match error messages
  suggestion: string;        // human-readable correction advice
  autoFix?: (args: Record<string, any>) => Record<string, any>;
  tools?: string[];           // restrict this rule to specific tool slugs (audit #8)
  occurrences: number;
  lastSeen: string;
}

/**
 * Observational Learning Engine.
 * 
 * Follows the platform principle: "Every failure is a free training signal.
 * The system must extract, persist, and apply lessons from errors without
 * human intervention."
 */
export class LearningEngine {
  private observations: FailureObservation[] = [];
  private rules: Map<string, AdaptationRule> = new Map();
  private memoryStore?: any; // MemoryStore | undefined (optional dependency)
  private initialized = false;

  /**
   * @param memoryStore — optional persistent MemoryStore. When provided,
   *   the Learning Engine survives restarts; when omitted, falls back to
   *   in-memory-only mode (development / no-SQLite environments).
   */
  constructor(memoryStore?: any) {
    this.memoryStore = memoryStore;
  }

  /**
   * Initialize the engine by loading persisted observations and rules.
   * Must be called once before use if a MemoryStore is configured.
   */
  public async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.memoryStore) {
      logger.info('No MemoryStore configured — learning is in-memory only (resets on restart).');
      this.initialized = true;
      return;
    }

    try {
      const { observations, rules } = await this.memoryStore.loadAll();
      this.observations = observations;
      for (const rule of rules) {
        this.rules.set(rule.id, rule);
      }
      logger.info(`Learning Engine initialized with ${observations.length} observations and ${rules.length} rules from persistent memory.`);
    } catch (err: any) {
      logger.error(`Failed to load from MemoryStore: ${err.message}. Starting fresh.`);
    }
    this.initialized = true;
  }

  /**
   * Records a failure observation from the task execution pipeline.
   */
  public async recordFailure(observation: FailureObservation): Promise<void> {
    if (!this.initialized) await this.init();

    logger.info(`Recording failure observation for task [${observation.taskId}]: ${observation.errorMessage}`);
    this.observations.push(observation);
    this.deriveRule(observation);

    // Persist to durable storage
    if (this.memoryStore) {
      this.memoryStore.saveObservation(observation).catch((err: any) =>
        logger.error(`Async save observation failed: ${err.message}`)
      );
    }
  }

  /**
   * Returns all learned adaptation rules for the Planner to inject into prompts.
   */
  public getAdaptationRules(): AdaptationRule[] {
    return Array.from(this.rules.values())
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Generates a "lessons learned" context block for the Planner's system prompt.
   */
  public generatePlannerContext(): string {
    const rules = this.getAdaptationRules();
    if (rules.length === 0) return '';

    let context = '\n## Recent Failure Adaptations (Automatically Learned)\n';
    context += 'The following patterns have caused failures in past runs. Avoid generating plans with these patterns.\n\n';

    for (const rule of rules.slice(0, 5)) {
      context += `- **${rule.suggestion}** (seen ${rule.occurrences}x, last: ${rule.lastSeen})\n`;
    }

    return context;
  }

  /**
   * Attempts to auto-correct task arguments based on learned patterns.
   * Applies only matching autoFix functions whose tools[] allowlist includes
   * the given toolSlug. If a rule has no tools[] filter, it applies universally.
   */
  public applyFixes(toolSlug: string, args: Record<string, any>): Record<string, any> {
    let fixed = { ...args };

    for (const rule of this.rules.values()) {
      // Filter: skip if rule has a tools allowlist and this tool is not in it
      if (rule.tools && rule.tools.length > 0 && !rule.tools.includes(toolSlug)) {
        continue;
      }
      if (rule.autoFix) {
        try {
          fixed = rule.autoFix(fixed);
          logger.info(`Applied auto-fix rule [${rule.id}] to tool "${toolSlug}"`);
        } catch {
          // skip broken autoFix functions
        }
      }
    }

    return fixed;
  }

  /**
   * Returns a summary of all observations for debugging/dashboard views.
   */
  public getStats(): { totalFailures: number; topRules: AdaptationRule[] } {
    return {
      totalFailures: this.observations.length,
      topRules: this.getAdaptationRules().slice(0, 10)
    };
  }

  /**
   * Derives adaptation rules from failure observations using pattern matching.
   */
  private deriveRule(obs: FailureObservation): void {
    const msg = obs.errorMessage.toLowerCase();

    // Known failure patterns and auto-fixes
    const patterns: Array<{ pattern: RegExp; suggestion: string; autoFix?: (a: Record<string, any>) => Record<string, any> }> = [
      {
        pattern: /no such file|enotdir|eacces/i,
        suggestion: 'Ensure file paths are absolute and parent directories exist.',
        autoFix: (args) => {
          if (args['path'] && !args['path'].startsWith('/')) {
            return { ...args, path: '/' + args['path'] };
          }
          return args;
        }
      },
      {
        pattern: /timeout|timed out|econnrefused/i,
        suggestion: 'Network-dependent tool timed out. Consider retrying or checking endpoint health.',
      },
      {
        pattern: /validation.*required/i,
        suggestion: 'Tool arguments failed schema validation. Ensure all required fields are populated.',
      },
      {
        pattern: /not found|unknown tool/i,
        suggestion: 'Tool slug does not match registry. Verify tool is correctly registered before scheduling.',
      },
      {
        pattern: /permission denied|unauthorized/i,
        suggestion: 'Tool lacks required permissions. Check API keys or access scopes.',
      }
    ];

    for (const p of patterns) {
      if (p.pattern.test(msg)) {
        const ruleId = `rule-${crypto.createHash('sha256').update(p.suggestion).digest('hex').slice(0, 16)}`;
        const ruleTools = p.autoFix ? (p as any).tools as string[] | undefined : undefined;
        const existing = this.rules.get(ruleId);
        let rule: AdaptationRule;
        if (existing) {
          existing.occurrences++;
          existing.lastSeen = obs.timestamp;
          rule = existing;
        } else {
          rule = {
            id: ruleId,
            pattern: p.pattern.source,
            suggestion: p.suggestion,
            autoFix: p.autoFix,
            tools: ruleTools,
            occurrences: 1,
            lastSeen: obs.timestamp
          };
          this.rules.set(ruleId, rule);
        }

        // Persist rule mutation
        if (this.memoryStore) {
          this.memoryStore.saveRule(rule).catch((err: any) =>
            logger.error(`Async save rule failed: ${err.message}`)
          );
        }
        break;
      }
    }
  }
}
