import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Embeddings');

// ── Rate limiter (prevents burst-rate API limit exhaustion) ──

class EmbeddingRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private refillRate: number;

  constructor(maxPerSec = 5, private maxTokens = maxPerSec) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = maxPerSec / 1000;
  }

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = now - this.lastRefill;
      this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
      this.lastRefill = now;
      if (this.tokens >= 1) { this.tokens -= 1; return; }
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

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
  private limiter = new EmbeddingRateLimiter(5);

  constructor(private apiKey: string, private model: string = 'text-embedding-3-small') {
    super();
  }

  public override async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  public override async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // Acquire one permit per item to enforce per-item rate limiting
    await Promise.all(texts.map(() => this.limiter.acquire()));
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
    return result.data.map((d: any) => ({
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
