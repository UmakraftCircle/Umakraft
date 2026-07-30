import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('Learning');
/**
 * Observational Learning Engine.
 *
 * Follows the platform principle: "Every failure is a free training signal.
 * The system must extract, persist, and apply lessons from errors without
 * human intervention."
 */
export class LearningEngine {
    observations = [];
    rules = new Map();
    memoryStore; // MemoryStore | undefined (optional dependency)
    initialized = false;
    /**
     * @param memoryStore — optional persistent MemoryStore. When provided,
     *   the Learning Engine survives restarts; when omitted, falls back to
     *   in-memory-only mode (development / no-SQLite environments).
     */
    constructor(memoryStore) {
        this.memoryStore = memoryStore;
    }
    /**
     * Initialize the engine by loading persisted observations and rules.
     * Must be called once before use if a MemoryStore is configured.
     */
    async init() {
        if (this.initialized)
            return;
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
        }
        catch (err) {
            logger.error(`Failed to load from MemoryStore: ${err.message}. Starting fresh.`);
        }
        this.initialized = true;
    }
    /**
     * Records a failure observation from the task execution pipeline.
     */
    async recordFailure(observation) {
        if (!this.initialized)
            await this.init();
        logger.info(`Recording failure observation for task [${observation.taskId}]: ${observation.errorMessage}`);
        this.observations.push(observation);
        this.deriveRule(observation);
        // Persist to durable storage
        if (this.memoryStore) {
            this.memoryStore.saveObservation(observation).catch((err) => logger.error(`Async save observation failed: ${err.message}`));
        }
    }
    /**
     * Returns all learned adaptation rules for the Planner to inject into prompts.
     */
    getAdaptationRules() {
        return Array.from(this.rules.values())
            .sort((a, b) => b.occurrences - a.occurrences);
    }
    /**
     * Generates a "lessons learned" context block for the Planner's system prompt.
     */
    generatePlannerContext() {
        const rules = this.getAdaptationRules();
        if (rules.length === 0)
            return '';
        let context = '\n## Recent Failure Adaptations (Automatically Learned)\n';
        context += 'The following patterns have caused failures in past runs. Avoid generating plans with these patterns.\n\n';
        for (const rule of rules.slice(0, 5)) {
            context += `- **${rule.suggestion}** (seen ${rule.occurrences}x, last: ${rule.lastSeen})\n`;
        }
        return context;
    }
    /**
     * Attempts to auto-correct task arguments based on learned patterns.
     * Applies all autoFix functions from matching adaptation rules.
     * Each autoFix function is responsible for checking whether its fix is needed.
     */
    applyFixes(toolSlug, args) {
        let fixed = { ...args };
        for (const rule of this.rules.values()) {
            if (rule.autoFix) {
                try {
                    fixed = rule.autoFix(fixed);
                    logger.info(`Applied auto-fix rule [${rule.id}] to tool "${toolSlug}"`);
                }
                catch {
                    // skip broken autoFix functions
                }
            }
        }
        return fixed;
    }
    /**
     * Returns a summary of all observations for debugging/dashboard views.
     */
    getStats() {
        return {
            totalFailures: this.observations.length,
            topRules: this.getAdaptationRules().slice(0, 10)
        };
    }
    /**
     * Derives adaptation rules from failure observations using pattern matching.
     */
    deriveRule(obs) {
        const msg = obs.errorMessage.toLowerCase();
        // Known failure patterns and auto-fixes
        const patterns = [
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
                let rule;
                if (existing) {
                    existing.occurrences++;
                    existing.lastSeen = obs.timestamp;
                    rule = existing;
                }
                else {
                    rule = {
                        id: ruleId,
                        pattern: p.pattern.source,
                        suggestion: p.suggestion,
                        autoFix: p.autoFix,
                        occurrences: 1,
                        lastSeen: obs.timestamp
                    };
                    this.rules.set(ruleId, rule);
                }
                // Persist rule mutation
                if (this.memoryStore) {
                    this.memoryStore.saveRule(rule).catch((err) => logger.error(`Async save rule failed: ${err.message}`));
                }
                break;
            }
        }
    }
}
//# sourceMappingURL=learning.js.map