import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ContextLoader,
  ContextLayer,
  ExecutionState,
  ExecutionContext,
} from '@ai-agent-platform/core';
import { AgentTask } from '@ai-agent-platform/shared';
import {
  MemoryEngine,
  SessionMemory,
  SemanticMemory,
  ProfileMemory,
  WorkingMemory,
} from '../../packages/tools/src/memory/index.js';

describe('Phase 7 — Intelligent Memory Retrieval Pipeline', () => {
  // ── Step 1: Separate Memory Types ──
  describe('Step 1: Separate Memory Sources', () => {
    it('isolates session, semantic, profile, and working memories independently', async () => {
      const session = new SessionMemory();
      session.addTurn('user', 'Please optimize the SQL queries in auth service.');

      const semantic = new SemanticMemory();
      semantic.addFact({
        category: 'knowledge',
        content: 'Postgres indexing on user_id reduces auth latency by 80%',
        toolSlug: 'db_query',
        tags: ['database', 'postgres', 'sql'],
      });

      const profile = new ProfileMemory({
        dbDialect: 'postgresql',
        maxPoolSize: 20,
      });

      const working = new WorkingMemory('task-101', {
        tempBuffer: 'intermediate-auth-data',
      });

      // Assert independent types
      assert.strictEqual(session.type, 'session');
      assert.strictEqual(semantic.type, 'semantic');
      assert.strictEqual(profile.type, 'profile');
      assert.strictEqual(working.type, 'working');

      // Assert sources do not bleed into each other
      assert.strictEqual(session.getTurns().length, 1);
      assert.strictEqual(profile.get('dbDialect'), 'postgresql');
      assert.strictEqual(working.get('tempBuffer'), 'intermediate-auth-data');
    });
  });

  // ── Step 2: Retrieval Pipeline via Context Loader ──
  describe('Step 2: Retrieval Pipeline & Context Loader Exclusive Access', () => {
    it('Context Loader is the sole consumer querying the Memory Engine for a task', async () => {
      const session = new SessionMemory();
      session.addTurn('user', 'Focus on payment webhooks');

      const semantic = new SemanticMemory();
      semantic.addFact({
        category: 'rule',
        content: 'Payment webhooks must verify HMAC signature',
        toolSlug: 'webhook_receiver',
        tags: ['payment', 'security'],
      });

      const profile = new ProfileMemory({
        currency: 'USD',
        compliance: 'PCI-DSS',
      });

      const engine = new MemoryEngine({ session, semantic, profile });
      const loader = new ContextLoader({ memoryEngine: engine });

      const task: AgentTask = {
        id: 'task-payment-verify',
        name: 'Verify payment webhook HMAC signature',
        toolSlug: 'webhook_receiver',
        arguments: { signature: 'sig_xyz', body: '{}' },
        dependencies: [],
      };

      // Context Loader queries Memory Engine
      const context = await loader.loadContext(task);

      assert.ok(Array.isArray(context.memories), 'context.memories must be an array');
      assert.ok(context.memories.length > 0, 'Relevant memories must be retrieved');

      // Ensure retrieved memories are relevant to payment/webhook
      const hasPaymentMemory = context.memories.some((m: any) =>
        (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).toLowerCase().includes('payment')
      );
      assert.ok(hasPaymentMemory, 'Payment webhook rule must be retrieved');
    });

    it('never injects all memories — only task-relevant memories capped by limit', async () => {
      const semantic = new SemanticMemory();
      // Add 20 unrelated facts
      for (let i = 0; i < 20; i++) {
        semantic.addFact({
          category: 'knowledge',
          content: `Unrelated fact #${i} about astronomy, botany, or art history`,
          tags: [`random-${i}`],
        });
      }
      // Add 1 relevant fact
      semantic.addFact({
        category: 'rule',
        content: 'Docker build requires --no-cache on production deploy',
        toolSlug: 'docker_build',
        tags: ['docker', 'deploy'],
      });

      const engine = new MemoryEngine({ semantic });
      const loader = new ContextLoader({ memoryEngine: engine });

      const task: AgentTask = {
        id: 'task-docker',
        name: 'Build docker container image',
        toolSlug: 'docker_build',
        arguments: { tag: 'v1.0' },
        dependencies: [],
      };

      const context = await loader.loadContext(task);

      // Must not inject all 21 facts
      assert.ok(context.memories.length <= 5, 'Context must never inject all memories; must cap results');
      assert.strictEqual(
        (context.memories[0] as any).toolSlug,
        'docker_build',
        'Top retrieved memory must match relevant task tool'
      );
    });
  });

  // ── Step 3: Memory Ranking ──
  describe('Step 3: Memory Ranking Factors', () => {
    it('ranks memories based on exact match, relevance, priority, and recency', async () => {
      const semantic = new SemanticMemory();

      // Fact A: Generic mention (low relevance)
      semantic.addFact({
        id: 'fact-generic',
        category: 'knowledge',
        content: 'General file system knowledge',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days ago
        priority: 0.2,
      });

      // Fact B: Exact toolSlug match
      semantic.addFact({
        id: 'fact-exact-tool',
        category: 'rule',
        content: 'File writer should atomic-write using temp file',
        toolSlug: 'filesystem_write',
        timestamp: new Date().toISOString(), // fresh
        priority: 0.9,
      });

      const engine = new MemoryEngine({ semantic });
      const task: AgentTask = {
        id: 'task-fs-write',
        name: 'Write config file to disk',
        toolSlug: 'filesystem_write',
        arguments: { path: '/etc/config.json' },
        dependencies: [],
      };

      const ranked = await engine.query({ task });

      assert.ok(ranked.length > 0, 'Ranked results must not be empty');
      assert.strictEqual(ranked[0].id, 'fact-exact-tool', 'Exact tool match must rank highest');
      assert.ok(ranked[0].score > 0.7, 'Top ranked score must be high');
      assert.strictEqual(ranked[0].rankingFactors.exactMatch, true);
    });
  });

  // ── Step 4: Working Memory Lifecycle ──
  describe('Step 4: Working Memory Lifecycle (Create -> Use -> Merge Output -> Destroy)', () => {
    it('ensures working memory is temporary, merges output, and is destroyed after task execution', async () => {
      const layer = new ContextLayer();
      const task: AgentTask = {
        id: 'task-scoped-wm',
        name: 'Process intermediate data',
        toolSlug: 'none',
        arguments: {},
        dependencies: [],
      };

      const state = new ExecutionState({
        request: 'Process data pipeline',
        plan: {
          id: 'plan-1',
          request: 'Process data pipeline',
          tasks: [task],
          createdAt: new Date().toISOString(),
        },
      });

      let workingMemoryInstance: any = null;

      await layer.withContext(task, state, async (context) => {
        // Lifecycle: 1. Create & 2. Use
        assert.ok(context.workingMemory, 'Working memory must be created for task');
        workingMemoryInstance = context.workingMemory;

        context.workingMemory.set('temp_calc', 42);
        assert.strictEqual(context.workingMemory.get('temp_calc'), 42);

        // Lifecycle: 3. Merge Output
        context.workingMemory.mergeOutput('processedRows', 150);

        return { success: true };
      });

      // Lifecycle: 4. Destroy
      assert.strictEqual(
        workingMemoryInstance.isDestroyed,
        true,
        'Working memory must be destroyed after task finishes'
      );
      assert.throws(
        () => workingMemoryInstance.get('temp_calc'),
        /destroyed/i,
        'Accessing destroyed working memory must throw error'
      );

      // Verify merged output exists in state outputs
      assert.strictEqual(
        state.outputs.get('task-scoped-wm:processedRows'),
        150,
        'Output from working memory must be merged into state'
      );
    });

    it('working memory never persists between consecutive tasks', async () => {
      const layer = new ContextLayer();

      const taskA: AgentTask = {
        id: 'task-A',
        name: 'Task A',
        toolSlug: 'none',
        arguments: {},
        dependencies: [],
      };

      const taskB: AgentTask = {
        id: 'task-B',
        name: 'Task B',
        toolSlug: 'none',
        arguments: {},
        dependencies: [],
      };

      const state = new ExecutionState({
        request: 'Two tasks pipeline',
        plan: {
          id: 'plan-2',
          request: 'Two tasks pipeline',
          tasks: [taskA, taskB],
          createdAt: new Date().toISOString(),
        },
      });

      // Run Task A
      await layer.withContext(taskA, state, async (context) => {
        context.workingMemory.set('taskASecret', 'alpha');
        return true;
      });

      // Run Task B
      await layer.withContext(taskB, state, async (context) => {
        assert.strictEqual(
          context.workingMemory.has('taskASecret'),
          false,
          'Task B working memory must NOT contain Task A data'
        );
        assert.strictEqual(
          context.workingMemory.get('taskASecret'),
          undefined,
          'Working memory must be fresh per task'
        );
        return true;
      });
    });
  });

  // ── Step 5: ExecutionState Memory Purity ──
  describe('Step 5: ExecutionState never stores retrieved memory contents', () => {
    it('verifies ExecutionState contains only outputs and workflow metadata, never raw memories', async () => {
      const task: AgentTask = {
        id: 'task-clean-state',
        name: 'Perform state purity test',
        toolSlug: 'none',
        arguments: {},
        dependencies: [],
      };

      const state = new ExecutionState({
        request: 'Verify state purity',
        plan: {
          id: 'plan-3',
          request: 'Verify state purity',
          tasks: [task],
          createdAt: new Date().toISOString(),
        },
      });

      // ExecutionState has no memories property
      assert.strictEqual(
        (state as any).memories,
        undefined,
        'ExecutionState must never have a memories property'
      );

      // Record output
      state.recordOutput(task.id, { result: 'ok' });
      assert.deepStrictEqual(state.outputs.get(task.id), { result: 'ok' });

      // Ensure state keys are strictly outputs, errors, taskGraph, completedTasks, failedTasks, metadata
      const stateKeys = Object.keys(state);
      assert.ok(!stateKeys.includes('memories'), 'ExecutionState keys must not contain memories');
    });
  });
});
