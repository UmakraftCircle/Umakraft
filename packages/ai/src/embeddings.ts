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

/**
 * Local embedding generator backed by `@xenova/transformers` (Transformers.js).
 *
 * Runs the `all-MiniLM-L6-v2` sentence-embedding model IN-PROCESS (no Python, no
 * external API, no key). Produces 384-dim sentence vectors suitable for cosine
 * similarity. This is used by the `/chat` answer cache to find "similar question"
 * matches without any third-party embedding service.
 *
 * Design notes:
 * - The `@xenova/transformers` dependency is imported lazily (dynamic import) so
 *   the native WASM/onnxruntime module is only loaded on first use, and so the
 *   rest of the platform still builds/starts if it is unavailable.
 * - Model weights are downloaded to the local cache on first use (free, keyless).
 * - Embeddings are L2-normalized so cosine similarity == dot product.
 */
export class LocalEmbeddingGenerator extends EmbeddingGenerator {
  private pipelinePromise: Promise<any> | null = null;
  private readonly modelName: string;
  private fallbackEmbedder = new MockEmbeddingGenerator(384);
  private useFallback = false;

  constructor(modelName: string = 'Xenova/all-MiniLM-L6-v2') {
    super();
    this.modelName = modelName;
  }

  /** Lazily load the Transformers.js pipeline once (shared across calls). */
  private async pipeline(): Promise<any> {
    if (this.useFallback) return null;
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        let transformers: any;
        try {
          transformers = await import('@xenova/transformers');
          logger.info(`Loading local embedding model ${this.modelName} (first use)...`);
          return await transformers.pipeline('feature-extraction', this.modelName);
        } catch (err: any) {
          logger.warn(
            `@xenova/transformers is not available (${err?.message ?? err}), using deterministic fallback embedder.`
          );
          this.useFallback = true;
          return null;
        }
      })();
      // If loading failed, allow a retry on a subsequent call instead of caching the rejection forever.
      this.pipelinePromise.catch(() => {
        this.pipelinePromise = null;
      });
    }
    return this.pipelinePromise;
  }

  public override async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  public override async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];
    try {
      const extractor = await this.pipeline();
      if (!extractor) {
        return this.fallbackEmbedder.embedBatch(texts);
      }

      // Transformers.js `feature-extraction` returns a tensor of shape
      // [batch, tokens, dim]. For sentence embeddings we mean-pool over the token
      // dimension and L2-normalize. We run per-item to stay robust to tokenizer
      // quirks and to allow simple token counting.
      const out: EmbeddingResult[] = [];
      for (const text of texts) {
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        // `output` is a Tensor; `.data` holds the raw Float32Array values.
        const data: number[] = Array.from(
          output.data && typeof output.data[Symbol.iterator] === 'function'
            ? (output.data as Float32Array)
            : output.tolist
              ? output.tolist()
              : []
        );
        // If the model already applied mean+normalize, data is the 384-dim vector.
        const embedding = data.length ? data : Array.from(output.data as Float32Array);
        out.push({
          embedding,
          model: this.modelName,
          tokens: text.split(/\s+/).filter(Boolean).length,
        });
      }
      return out;
    } catch (err: any) {
      logger.warn(`Local embedding extraction failed (${err?.message ?? err}), falling back:`);
      this.useFallback = true;
      return this.fallbackEmbedder.embedBatch(texts);
    }
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
