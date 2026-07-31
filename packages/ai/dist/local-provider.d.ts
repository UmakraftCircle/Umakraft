import type { GenerateOptions, AIService } from './index.js';
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
export declare class LocalProvider implements AIService {
    private brain;
    getCurrentModel(): string;
    generate(options: GenerateOptions): Promise<string>;
    generateStructuredOutput(options: GenerateOptions): Promise<any>;
}
//# sourceMappingURL=local-provider.d.ts.map