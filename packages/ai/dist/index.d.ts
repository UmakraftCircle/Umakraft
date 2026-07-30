export interface GenerateOptions {
    system?: string;
    prompt: string;
    schema?: any;
}
export declare abstract class AIService {
    abstract generate(options: GenerateOptions): Promise<string>;
    abstract generateStructuredOutput(options: GenerateOptions): Promise<any>;
    abstract getCurrentModel(): string;
}
export declare class MockAIService extends AIService {
    private modelName;
    constructor(modelName?: string);
    getCurrentModel(): string;
    generate(options: GenerateOptions): Promise<string>;
    generateStructuredOutput(options: GenerateOptions): Promise<any>;
}
export * from './providers.js';
export * from './embeddings.js';
export * from './prompts.js';
//# sourceMappingURL=index.d.ts.map