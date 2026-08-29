import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { OpenAIProvider, createProvider } from '../../packages/ai/src/providers.js';

describe('OpenAIProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('generate() should extract and return the content string from API response object', async () => {
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello trainers! Ready for today’s race?',
              },
            },
          ],
        }),
      } as any;
    };

    const provider = new OpenAIProvider('dummy-key', 'gpt-4o');
    const result = await provider.generate({
      system: 'You are a trainer helper',
      prompt: 'Say hello',
    });

    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result, 'Hello trainers! Ready for today’s race?');
    // Ensure .trim() can be safely called on the result
    assert.strictEqual(result.trim(), 'Hello trainers! Ready for today’s race?');
  });

  it('generateStructuredOutput() with JSON path should parse string output', async () => {
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({ action: 'celebrate', count: 3 }),
              },
            },
          ],
        }),
      } as any;
    };

    const provider = new OpenAIProvider('dummy-key', 'gpt-4o');
    const result = await provider.generateStructuredOutput({
      prompt: 'Output json',
    });

    assert.deepStrictEqual(result, { action: 'celebrate', count: 3 });
  });

  it('generate() should throw if no text content is returned in choices', async () => {
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
              },
            },
          ],
        }),
      } as any;
    };

    const provider = new OpenAIProvider('dummy-key', 'gpt-4o');
    await assert.rejects(
      () => provider.generate({ prompt: 'test' }),
      /Model returned no text content/,
    );
  });
});
