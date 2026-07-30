export interface EmbeddingResult {
    embedding: number[];
    model: string;
    tokens: number;
}
/**
 * Abstract embedding generator.
 * Supports OpenAI, local models, or mock fallback for testing.
 */
export declare abstract class EmbeddingGenerator {
    abstract embed(text: string): Promise<EmbeddingResult>;
    abstract embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}
/**
 * OpenAI embedding adapter (text-embedding-3-small).
 */
export declare class OpenAIEmbeddingGenerator extends EmbeddingGenerator {
    private apiKey;
    private model;
    constructor(apiKey: string, model?: string);
    embed(text: string): Promise<EmbeddingResult>;
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}
/**
 * Mock embedding generator for testing — returns deterministic pseudo-embeddings.
 */
export declare class MockEmbeddingGenerator extends EmbeddingGenerator {
    private dimension;
    constructor(dimension?: number);
    embed(text: string): Promise<EmbeddingResult>;
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
    /**
     * Generates a deterministic pseudo-embedding from text content.
     * Not semantically meaningful, but useful for testing vector operations.
     */
    private pseudoEmbed;
}
export declare function cosineSimilarity(a: number[], b: number[]): number;
//# sourceMappingURL=embeddings.d.ts.map