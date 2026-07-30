import type { GenerateOptions, AIService } from './index.js';
export declare class OpenAIProvider implements AIService {
    private apiKey;
    private model;
    constructor(apiKey: string, model?: string);
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
export type ProviderType = 'openai' | 'anthropic';
export declare function createProvider(type: ProviderType, apiKey: string, model?: string): AIService;
//# sourceMappingURL=providers.d.ts.map