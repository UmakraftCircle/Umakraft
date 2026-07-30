import { createLogger } from '@ai-agent-platform/shared';

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

  /**
   * Records a failure observation from the task execution pipeline.
   */
  public recordFailure(observation: FailureObservation): void {
    logger.info(`Recording failure observation for task [${observation.taskId}]: ${observation.errorMessage}`);
    this.observations.push(observation);
    this.deriveRule(observation);
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
   */
  public applyFixes(toolSlug: string, args: Record<string, any>): Record<string, any> {
    let fixed = { ...args };

    for (const rule of this.rules.values()) {
      if (rule.autoFix && rule.pattern) {
        try {
          const regex = new RegExp(rule.pattern);
          // If any argument value matches this failure pattern, apply the fix
          for (const [key, value] of Object.entries(fixed)) {
            if (typeof value === 'string' && regex.test(value)) {
              fixed = rule.autoFix(fixed);
              logger.info(`Applied auto-fix rule [${rule.id}] to argument "${key}"`);
              break;
            }
          }
        } catch {
          // skip invalid regex patterns
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
        const ruleId = `rule-${Buffer.from(p.suggestion).toString('base64').slice(0, 12)}`;
        const existing = this.rules.get(ruleId);
        if (existing) {
          existing.occurrences++;
          existing.lastSeen = obs.timestamp;
        } else {
          this.rules.set(ruleId, {
            id: ruleId,
            pattern: p.pattern.source,
            suggestion: p.suggestion,
            autoFix: p.autoFix,
            occurrences: 1,
            lastSeen: obs.timestamp
          });
        }
        break;
      }
    }
  }
}
