import { test } from 'node:test';
import assert from 'node:assert';
import {
  AgentRegistry,
  AgentRouter,
  Orchestrator,
  CoachAgent,
  ParentAgent,
  ClubAgent,
  MetaAgent,
  KnowledgeAgent,
  VisionAgent,
  OperationsAgent,
  AgentPriority
} from '../../packages/lily-ai/src/agents/index.js';

test('E3 — Multi-Agent Club Operations', async (t) => {
  const registry = new AgentRegistry();
  const coach = new CoachAgent();
  const parent = new ParentAgent();
  const club = new ClubAgent();
  const meta = new MetaAgent();
  const knowledge = new KnowledgeAgent();
  const vision = new VisionAgent();
  const operations = new OperationsAgent();

  registry.register(coach);
  registry.register(parent);
  registry.register(club);
  registry.register(meta);
  registry.register(knowledge);
  registry.register(vision);
  registry.register(operations);

  const router = new AgentRouter(registry);
  const orchestrator = new Orchestrator(registry, router);

  await t.test('E3.1 Routing - Single Agent matching input (Parent)', async () => {
    const context = {
      input: 'Need a long-distance parent with stamina inheritance.',
      shared: {},
      priority: AgentPriority.NORMAL
    };
    const matched = await router.route(context);
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].id, 'parent');
  });

  await t.test('E3.2 Routing - Single Agent matching input (Coach)', async () => {
    const context = {
      input: 'How do I build Oguri Cap?',
      shared: {},
      priority: AgentPriority.NORMAL
    };
    const matched = await router.route(context);
    assert.strictEqual(matched.length, 1);
    assert.strictEqual(matched[0].id, 'coach');
  });

  await t.test('E3.3 Shared Context & Orchestrator execution', async () => {
    const context = {
      input: 'How to build Kitasan Black?',
      shared: { character: 'Kitasan Black' },
      priority: AgentPriority.HIGH
    };
    const result = await orchestrator.execute(context);
    assert.strictEqual(result.success, true);
    assert.ok(result.output.includes('Coach Agent recommendation'));
    assert.ok(result.output.includes('Kitasan Black'));
  });

  await t.test('E3.4 Collaboration - Multi-Agent triggering and execution logs', async () => {
    // Input that triggers both Meta and Coach agents
    const context = {
      input: 'What is the current meta build for next Champions Meeting?',
      shared: { character: 'Kitasan Black' },
      priority: AgentPriority.CRITICAL
    };
    const result = await orchestrator.execute(context);
    assert.strictEqual(result.success, true);
    
    // Output should contain responses from both agents
    assert.ok(result.output.includes('Meta Agent'));
    assert.ok(result.output.includes('Coach Agent'));

    // Verify execution logs are filled
    const logs = orchestrator.getExecutionLogs();
    assert.ok(logs.length >= 2);
    assert.strictEqual(logs[0].success, true);
  });
});
