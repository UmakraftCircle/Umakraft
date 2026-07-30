import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('Embeddings');
/**
 * Abstract embedding generator.
 * Supports OpenAI, local models, or mock fallback for testing.
 */
export class EmbeddingGenerator {
}
/**
 * OpenAI embedding adapter (text-embedding-3-small).
 */
export class OpenAIEmbeddingGenerator extends EmbeddingGenerator {
    apiKey;
    model;
    constructor(apiKey, model = 'text-embedding-3-small') {
        super();
        this.apiKey = apiKey;
        this.model = model;
    }
    async embed(text) {
        const results = await this.embedBatch([text]);
        return results[0];
    }
    async embedBatch(texts) {
        logger.info(`Generating embeddings for ${texts.length} texts via OpenAI ${this.model}...`);
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({ model: this.model, input: texts })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI embeddings failed (${response.status}): ${errText}`);
        }
        const result = await response.json();
        return result.data.map((d) => ({
            embedding: d.embedding,
            model: this.model,
            tokens: d.usage?.total_tokens || 0
        }));
    }
}
/**
 * Mock embedding generator for testing — returns deterministic pseudo-embeddings.
 */
export class MockEmbeddingGenerator extends EmbeddingGenerator {
    dimension;
    constructor(dimension = 128) {
        super();
        this.dimension = dimension;
    }
    async embed(text) {
        return {
            embedding: this.pseudoEmbed(text),
            model: 'mock-embedding-v1',
            tokens: text.split(/\s+/).length
        };
    }
    async embedBatch(texts) {
        return texts.map(text => ({
            embedding: this.pseudoEmbed(text),
            model: 'mock-embedding-v1',
            tokens: text.split(/\s+/).length
        }));
    }
    /**
     * Generates a deterministic pseudo-embedding from text content.
     * Not semantically meaningful, but useful for testing vector operations.
     */
    pseudoEmbed(text) {
        const vec = new Array(this.dimension).fill(0);
        for (let i = 0; i < text.length; i++) {
            const idx = i % this.dimension;
            vec[idx] += text.charCodeAt(i) / 1000;
        }
        // Normalize
        const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
        return vec.map(v => v / (magnitude || 1));
    }
}
// ── Cosine similarity ──
export function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        throw new Error('Vectors must have same dimension');
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}
//# sourceMappingURL=embeddings.js.map