import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('Prompts');
/**
 * Central prompt registry.
 * All system-level prompt templates live here so they can be versioned,
 * audited, and A/B tested without touching application code.
 */
export class PromptLibrary {
    templates = new Map();
    constructor() {
        this.registerDefaults();
    }
    /**
     * Registers a new prompt template.
     */
    register(template) {
        if (this.templates.has(template.name)) {
            logger.warn(`Overwriting existing prompt template: ${template.name}`);
        }
        this.templates.set(template.name, template);
        logger.info(`Registered prompt template: ${template.name} v${template.version}`);
    }
    /**
     * Renders a prompt by name with variable substitution.
     */
    render(name, variables = {}) {
        const template = this.templates.get(name);
        if (!template) {
            logger.error(`Prompt template not found: ${name}`);
            return null;
        }
        return {
            system: template.system,
            user: template.userTemplate(variables)
        };
    }
    /**
     * Lists all registered template names.
     */
    list() {
        return Array.from(this.templates.keys());
    }
    registerDefaults() {
        // ── Master Planner Prompt ──
        this.register({
            name: 'master-planner',
            version: '1.0.0',
            system: `You are the Master Planner for the AI Agent Platform.
Your task is to decompose complex user intents into a sequence of discrete, executable tasks.

Rules:
1. Each task MUST map to exactly one of the available declarative tools.
2. Tasks form a Directed Acyclic Graph (DAG) — dependencies must be explicit and acyclic.
3. Prefer parallel execution: tasks that don't depend on each other should not be chained.
4. Include a final "Persist Results in SQLite DB" step to store all execution results.
5. Estimate maxRetries based on tool reliability: network tools (3), filesystem (1), notifications (2).

Output ONLY valid JSON with this schema:
{
  "tasks": [
    {
      "id": "task-N",
      "name": "...",
      "toolSlug": "...",
      "arguments": { ... },
      "dependencies": [...],
      "maxRetries": N
    }
  ]
}`,
            userTemplate: (vars) => `Plan a sequence of operations to solve this: "${vars['intent']}"

Available tools:
${vars['tools'] || 'No tools available'}`
        });
        // ── Code Review Prompt ──
        this.register({
            name: 'code-review',
            version: '1.0.0',
            system: `You are an expert software engineer performing a code review.
Focus on: security vulnerabilities, performance issues, architectural anti-patterns, and type safety.
Be concise. Provide actionable feedback with line references where possible.`,
            userTemplate: (vars) => `Review the following code:\n\n\`\`\`${vars['language'] || 'typescript'}\n${vars['code']}\n\`\`\`\n\nContext: ${vars['context'] || 'General review'}`
        });
        // ── Error Analysis Prompt ──
        this.register({
            name: 'error-analysis',
            version: '1.0.0',
            system: `You are a debugging assistant for the AI Agent Platform.
Given a task failure, analyze the root cause and suggest a concrete fix.
Your response must be in JSON:
{
  "rootCause": "...",
  "fix": "...",
  "confidence": "high" | "medium" | "low"
}`,
            userTemplate: (vars) => `Task "${vars['taskName']}" using tool "${vars['toolSlug']}" failed with error:
${vars['errorMessage']}

Task arguments: ${vars['arguments']}
Recent adaptation rules: ${vars['adaptationContext'] || 'None'}`
        });
        // ── Summarization Prompt ──
        this.register({
            name: 'summarize',
            version: '1.0.0',
            system: `You are a summarization engine. Produce a concise, structured summary in markdown format.
Focus on key decisions, action items, and metrics.`,
            userTemplate: (vars) => `Summarize the following content:\n\n${vars['content']}\n\nDesired length: ${vars['length'] || 'medium'}`
        });
    }
}
// Singleton instance
export const promptLibrary = new PromptLibrary();
//# sourceMappingURL=prompts.js.map