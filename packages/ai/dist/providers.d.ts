import type { GenerateOptions, AIService } from './index.js';
export declare class OpenAIProvider implements AIService {
    #private;
    private model;
    private keys;
    private baseUrl;
    /**
     * @param apiKey   Single key, comma-separated keys ("k1,k2,k3"), or array
     * @param model    Model name (default: gpt-4o-mini)
     * @param baseUrl  API base URL (default: https://api.openai.com)
     */
    constructor(apiKey: string | string[], model?: string, baseUrl?: string);
    getCurrentModel(): string;
    generate(options: GenerateOptions): Promise<string>;
    generateStructuredOutput(options: GenerateOptions): Promise<any>;
}
export declare class AnthropicProvider implements AIService {
    private apiKey;
    private model;
    constructor(apiKey: string, model?: string);
    getCurrentModel(): string;
    generate(options: GenerateOptions): Promise<string>;
    generateStructuredOutput(options: GenerateOptions): Promise<any>;
}
export type ProviderType = 'openai' | 'anthropic' | 'groq';
/**
 * Create an AI provider instance.
 *
 * Groq uses the OpenAI-compatible endpoint with key rotation.
 * Pass multiple keys as comma-separated: `GROQ_API_KEY=key1,key2,key3`
 */
export declare function createProvider(type: ProviderType, apiKey: string, model?: string): AIService;
//# sourceMappingURL=providers.d.ts.map