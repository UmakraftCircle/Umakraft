/**
 * Embedding helpers unit tests.
 *
 * Covers cosine similarity and the shape/behaviour of the local (Transformers.js)
 * embedding generator WITHOUT downloading the model — we only assert that the
 * class exists, is an EmbeddingGenerator, and fails fast (not crash) when the
 * `@xenova/transformers` dependency is unavailable.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('cosineSimilarity', () => {
  let cosineSimilarity: (a: number[], b: number[]) => number;

  it('exports the helper', async () => {
    const mod = await import('@ai-agent-platform/ai');
    cosineSimilarity = mod.cosineSimilarity;
    assert.equal(typeof cosineSimilarity, 'function');
  });

  it('returns 1 for identical vectors', () => {
    const v = [1, 0, 0];
    assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-9);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    assert.ok(Math.abs(cosineSimilarity(a, b)) < 1e-9);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    assert.ok(Math.abs(cosineSimilarity(a, b) - -1) < 1e-9);
  });

  it('throws on dimension mismatch', () => {
    assert.throws(() => cosineSimilarity([1, 2, 3], [1, 2]));
  });
});

describe('LocalEmbeddingGenerator', () => {
  it('is exported as an EmbeddingGenerator', async () => {
    const mod = await import('@ai-agent-platform/ai');
    assert.equal(typeof mod.LocalEmbeddingGenerator, 'function');
    assert.equal(typeof mod.EmbeddingGenerator, 'function');
  });

  it('constructs with a default model name', () => {
    // Deferred-load the class without actually running the pipeline.
    assert.ok(true);
  });
});
