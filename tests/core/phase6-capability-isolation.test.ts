import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ToolRegistry,
  ContextLayer,
  ExecutorLayer,
  ExecutionState,
  ToolCapability,
  DisposableToolInstance,
} from '@ai-agent-platform/core';
import { AgentTask } from '@ai-agent-platform/shared';

describe('Phase 6 — Tool Registry & Capability Isolation', () => {
  const registry = ToolRegistry.getInstance();

  it('exposes capability metadata without eager instantiation', () => {
    let factoryCalled = false;
    const testCapId = `cap-test-${Date.now()}`;

    const capability: ToolCapability = {
      id: testCapId,
      name: 'Test Lazy Capability',
      description: 'Verifies lazy capability loading',
      category: 'testing',
      lazy: true,
      parameters: {
        msg: { type: 'string', description: 'Test message', required: true },
      },
    };

    registry.registerCapability({
      capability,
      factory: () => {
        factoryCalled = true;
        let disposed = false;
        return {
          slug: testCapId,
          name: capability.name,
          description: capability.description,
          parameters: capability.parameters!,
          get isDisposed() {
            return disposed;
          },
          set isDisposed(v: boolean) {
            disposed = v;
          },
          dispose: () => {
            disposed = true;
          },
          handler: async (args: any) => ({ echoed: args.msg }),
        };
      },
    });

    // Verify metadata is available
    const caps = registry.getCapabilities();
    const found = caps.find((c) => c.id === testCapId);
    assert.ok(found, 'Capability must be listed in registry');
    assert.strictEqual(found.lazy, true);
    assert.strictEqual(found.category, 'testing');

    // Verify declarative schemas list it without exposing handler
    const schemas = registry.getDeclarativeSchemas();
    const schema = schemas.find((s) => s.slug === testCapId);
    assert.ok(schema, 'Schema must be exposed for LLM function calling');
    assert.strictEqual(schema.handler, undefined);

    // CRITICAL: Factory must NOT have been called yet
    assert.strictEqual(factoryCalled, false, 'Factory should not run during registration');
  });

  it('lazily instantiates and isolates tool instances on resolve', async () => {
    let factoryCalls = 0;
    const testCapId = `cap-lazy-inst-${Date.now()}`;

    registry.registerCapability({
      capability: {
        id: testCapId,
        name: 'Lazy Counter Instance',
        description: 'Verifies isolated instances',
        lazy: true,
      },
      factory: () => {
        factoryCalls++;
        let disposed = false;
        const instanceId = factoryCalls;
        return {
          slug: testCapId,
          name: 'Lazy Counter Instance',
          description: 'Verifies isolated instances',
          parameters: {},
          get isDisposed() {
            return disposed;
          },
          set isDisposed(v: boolean) {
            disposed = v;
          },
          dispose: () => {
            disposed = true;
          },
          handler: async () => ({ instanceId }),
        };
      },
    });

    // Resolving triggers the factory
    const instance1 = await registry.resolve(testCapId);
    assert.ok(instance1);
    assert.strictEqual(factoryCalls, 1);
    assert.strictEqual(instance1.isDisposed, false);

    const data1 = await instance1.handler({});
    assert.strictEqual(data1.instanceId, 1);

    // Resolving again produces a separate, isolated instance
    const instance2 = await registry.resolve(testCapId);
    assert.ok(instance2);
    assert.strictEqual(factoryCalls, 2);
    assert.notStrictEqual(instance1, instance2, 'Instances must be distinct and isolated');

    // Disposing instance 1 does not affect instance 2
    instance1.dispose();
    assert.strictEqual(instance1.isDisposed, true);
    assert.strictEqual(instance2.isDisposed, false);

    instance2.dispose();
    assert.strictEqual(instance2.isDisposed, true);
  });

  it('ContextLayer scopes tool capabilities and disposes them upon completion', async () => {
    const testCapId = `cap-ctx-lifecycle-${Date.now()}`;
    let disposed = false;

    registry.registerCapability({
      capability: {
        id: testCapId,
        name: 'Scoped Context Tool',
        description: 'Scoped context test',
        lazy: true,
      },
      factory: () => ({
        slug: testCapId,
        name: 'Scoped Context Tool',
        description: 'Scoped context test',
        parameters: {},
        get isDisposed() {
          return disposed;
        },
        set isDisposed(v: boolean) {
          disposed = v;
        },
        dispose: () => {
          disposed = true;
        },
        handler: async (args: any) => ({ handled: true, ...args }),
      }),
    });

    const contextLayer = new ContextLayer({ toolRegistry: registry });
    const task: AgentTask = {
      id: 'task-scoped-01',
      name: 'Run scoped tool task',
      toolSlug: testCapId,
      arguments: { testKey: 'val123' },
      dependencies: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    };

    const state = new ExecutionState();

    let capturedInstance: DisposableToolInstance | undefined;

    const result = await contextLayer.withContext(task, state, async (ctx) => {
      assert.ok(ctx.tools.has(testCapId), 'Capability should be resolved into ExecutionContext');
      capturedInstance = ctx.tools.get(testCapId);
      assert.ok(capturedInstance);
      assert.strictEqual(capturedInstance.isDisposed, false);

      return await capturedInstance.handler(task.arguments);
    });

    assert.deepStrictEqual(result, { handled: true, testKey: 'val123' });
    // After withContext finishes, the instance MUST be disposed!
    assert.ok(capturedInstance);
    assert.strictEqual(capturedInstance.isDisposed, true, 'Tool instance must not survive task context');
  });

  it('ExecutorLayer executes tool capability via ExecutionContext without tool imports', async () => {
    const testCapId = `cap-exec-context-${Date.now()}`;
    let executions = 0;

    registry.registerCapability({
      capability: {
        id: testCapId,
        name: 'Execution Context Tool',
        description: 'Tests executor integration',
        lazy: true,
      },
      factory: () => {
        let disposed = false;
        return {
          slug: testCapId,
          name: 'Execution Context Tool',
          description: 'Tests executor integration',
          parameters: {},
          get isDisposed() {
            return disposed;
          },
          set isDisposed(v: boolean) {
            disposed = v;
          },
          dispose: () => {
            disposed = true;
          },
          handler: async (args: any) => {
            executions++;
            return { executed: true, args };
          },
        };
      },
    });

    const contextLayer = new ContextLayer({ toolRegistry: registry });
    const executorLayer = new ExecutorLayer({ registry, contextLayer });

    const task: AgentTask = {
      id: 'task-exec-02',
      name: 'Execute task using context capability',
      toolSlug: testCapId,
      arguments: { action: 'refresh' },
      dependencies: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    };

    const state = new ExecutionState();

    const taskResult = await contextLayer.withContext(task, state, async (context) => {
      return await executorLayer.executeTask(task, context);
    });

    assert.strictEqual(taskResult.success, true);
    assert.strictEqual(executions, 1);
    assert.deepStrictEqual(taskResult.data, { executed: true, args: { action: 'refresh' } });
  });
});
