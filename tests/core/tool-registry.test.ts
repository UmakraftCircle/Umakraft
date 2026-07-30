/**
 * ToolRegistry Unit Tests (singleton-safe)
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('ToolRegistry', () => {
  let ToolRegistry: any;
  let registry: any;

  before(async () => {
    const mod = await import('@ai-agent-platform/core');
    ToolRegistry = mod.ToolRegistry;
    registry = ToolRegistry.getInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const a = ToolRegistry.getInstance();
      const b = ToolRegistry.getInstance();
      assert.strictEqual(a, b);
    });

    it('should have declarative schemas (tools may already be registered)', () => {
      const schemas = registry.getDeclarativeSchemas();
      assert.ok(Array.isArray(schemas));
    });
  });

  describe('registration', () => {
    it('should register a new tool', () => {
      const slug = `test-reg-${Date.now()}`;
      registry.register({
        slug,
        name: 'Test Registration',
        description: 'A test tool for registration',
        parameters: {
          input: { type: 'string', description: 'Input', required: true },
        },
        handler: async (args: any) => ({ result: args.input }),
      });

      const schemas = registry.getDeclarativeSchemas();
      const found = schemas.find((s: any) => s.slug === slug);
      assert.ok(found);
      assert.equal(found.handler, undefined); // handler stripped
    });

    it('should throw on duplicate slug', () => {
      const slug = `test-dupe-${Date.now()}`;
      const tool = {
        slug,
        name: 'Dupe',
        description: '...',
        parameters: {},
        handler: async () => ({}),
      };
      registry.register(tool);
      assert.throws(() => registry.register(tool), /already exists/i);
    });
  });

  describe('execution', () => {
    it('should execute a tool and return success', async () => {
      const slug = `test-echo-${Date.now()}`;
      registry.register({
        slug,
        name: 'Echo',
        description: 'Echoes input',
        parameters: { message: { type: 'string', description: 'Msg', required: true } },
        handler: async (args: any) => `Echo: ${args.message}`,
      });

      const result = await registry.execute(slug, { message: 'hello' });
      assert.ok(result.success);
      assert.equal(result.data, 'Echo: hello');
    });

    it('should return failure for unknown tool slug', async () => {
      const result = await registry.execute(`nonexistent-${Date.now()}`, {});
      assert.equal(result.success, false);
      assert.ok(result.error!.includes('Unknown'));
    });

    it('should return failure when handler throws', async () => {
      const slug = `test-explode-${Date.now()}`;
      registry.register({
        slug,
        name: 'Explode',
        description: 'Always fails',
        parameters: {},
        handler: async () => { throw new Error('Kaboom!'); },
      });

      const result = await registry.execute(slug, {});
      assert.equal(result.success, false);
      assert.ok(result.error!.includes('Kaboom'));
    });

    it('should pass arguments correctly to handler', async () => {
      const slug = `test-capture-${Date.now()}`;
      let capturedArgs: any = null;
      registry.register({
        slug,
        name: 'Capture',
        description: 'Captures args',
        parameters: {
          x: { type: 'number', description: 'X', required: true },
          y: { type: 'string', description: 'Y', required: false },
        },
        handler: async (args: any) => { capturedArgs = args; return 'ok'; },
      });

      await registry.execute(slug, { x: 42, y: 'test' });
      assert.deepEqual(capturedArgs, { x: 42, y: 'test' });
    });
  });

  describe('getDeclarativeSchemas', () => {
    it('should strip handler from all schemas', () => {
      const schemas = registry.getDeclarativeSchemas();
      for (const s of schemas) {
        assert.equal(s.handler, undefined, `Tool ${s.slug} should not expose handler`);
      }
    });
  });
});
