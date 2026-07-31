import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Embeddings');

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens: number;
}

/**
 * Abstract embedding generator.
 * Supports OpenAI, local models, or mock fallback for testing.
 */
export abstract class EmbeddingGenerator {
  abstract embed(text: string): Promise<EmbeddingResult>;
  abstract embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}

/**
 * OpenAI embedding adapter (text-embedding-3-small).
 */
export class OpenAIEmbeddingGenerator extends EmbeddingGenerator {
  constructor(private apiKey: string, private model: string = 'text-embedding-3-small') {
    super();
  }

  public override async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  public override async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    logger.info(`Generating embeddings for ${texts.length} texts via OpenAI ${this.model}...`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI embeddings failed (${response.status}): ${errText}`);
      }

      const result = await response.json();
      return result.data.map((d: any) => ({
        embedding: d.embedding,
        model: this.model,
        tokens: d.usage?.total_tokens || 0
      }));
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Mock embedding generator for testing — returns deterministic pseudo-embeddings.
 */
export class MockEmbeddingGenerator extends EmbeddingGenerator {
  private dimension: number;

  constructor(dimension: number = 128) {
    super();
    this.dimension = dimension;
  }

  public override async embed(text: string): Promise<EmbeddingResult> {
    return {
      embedding: this.pseudoEmbed(text),
      model: 'mock-embedding-v1',
      tokens: text.split(/\s+/).length
    };
  }

  public override async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
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
  private pseudoEmbed(text: string): number[] {
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

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have same dimension');
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}
