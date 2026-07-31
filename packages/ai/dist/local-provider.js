import { createLogger } from '@ai-agent-platform/shared';
import { getLocalBrain } from './local-brain.js';
const logger = createLogger('LocalProvider');
/**
 * AI service backed by the local Qwen 0.5B model.
 *
 * Use this for lightweight tasks that don't need the full power of Groq:
 * - Generating messages from cached data
 * - Simple decision-making (yes/no/skip)
 * - Formatting leaderboard responses
 *
 * For complex planning and structured JSON output, use Groq via OpenAIProvider.
 */
export class LocalProvider {
    brain = getLocalBrain();
    getCurrentModel() {
        return 'qwen2.5-0.5b-instruct-q3_k_m (local)';
    }
    // ── Simple text generation ──────────────────────────────
    async generate(options) {
        await this.brain.init();
        return this.brain.prompt(options.prompt, options.system);
    }
    // ── Structured output with recovery ─────────────────────
    async generateStructuredOutput(options) {
        await this.brain.init();
        // Small models need explicit JSON hints
        const system = (options.system || '') +
            '\n\nCRITICAL: You MUST respond with ONLY a valid JSON object on a single line. ' +
            'No markdown fences, no explanation, no trailing text. Just the JSON.';
        const raw = await this.brain.prompt(options.prompt, system);
        // ── JSON extraction pipeline ──
        // Small models often add markdown fences or extra text despite instructions
        // 1. Direct parse
        try {
            return JSON.parse(raw);
        }
        catch { /* continue */ }
        // 2. Extract from markdown code fences
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (fenceMatch) {
            try {
                return JSON.parse(fenceMatch[1].trim());
            }
            catch { /* continue */ }
        }
        // 3. Find first { ... } block
        const braceMatch = raw.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            try {
                return JSON.parse(braceMatch[0]);
            }
            catch { /* continue */ }
        }
        // 4. Find first [ ... ] block (arrays)
        const arrMatch = raw.match(/\[[\s\S]*\]/);
        if (arrMatch) {
            try {
                return JSON.parse(arrMatch[0]);
            }
            catch { /* continue */ }
        }
        logger.warn(`Local model produced unparseable output. ` +
            `Raw (${raw.length} chars): ${raw.slice(0, 300)}`);
        throw new Error(`Local model failed to produce valid JSON. ` +
            `Consider using Groq for structured output tasks.`);
    }
}
//# sourceMappingURL=local-provider.js.map