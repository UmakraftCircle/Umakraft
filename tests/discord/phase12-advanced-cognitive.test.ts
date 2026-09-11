import { test, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Planner, KnowledgeGraph, LearningEngine } from '@ai-agent-platform/core';
import { AIService, type GenerateOptions } from '@ai-agent-platform/ai';

class CustomPlannerAIService extends AIService {
  getCurrentModel(): string {
    return 'mock-planner-model';
  }
  async generate(options: GenerateOptions): Promise<string> {
    return 'Plan generated';
  }
  async generateStructuredOutput(options: GenerateOptions): Promise<any> {
    return {
      tasks: [
        {
          id: 'task-1',
          name: 'Find Docs',
          toolSlug: 'search_knowledge',
          arguments: { query: 'deployment' },
          dependencies: [],
          layer: 0,
        }
      ]
    };
  }
}

describe('Phase 12: Advanced AI Capabilities & Cognitive Agent System', () => {
  it('1. Advanced Planning & Goal Decomposition', async () => {
    const ai = new CustomPlannerAIService();
    const planner = new Planner(ai);

    const plan = await planner.plan('Create a complete project deployment guide.');
    assert.ok(plan);
    assert.strictEqual(plan.tasks.size, 1);
    const task = plan.tasks.get('task-1');
    assert.ok(task);
    assert.strictEqual(task.toolSlug, 'search_knowledge');
  });

  it('2. Memory Graph Nodes & Relationships', async () => {
    const kg = new KnowledgeGraph();
    await kg.reset();

    await kg.upsertNode({
      id: 'user_lord',
      type: 'entity',
      label: 'Lord of Umakraft',
      description: 'Lead Trainer',
    });

    await kg.upsertNode({
      id: 'tech_ts',
      type: 'concept',
      label: 'TypeScript',
      description: 'Type system',
    });

    await kg.addEdge({
      sourceId: 'user_lord',
      targetId: 'tech_ts',
      relationship: 'likes',
      weight: 0.9,
    });

    const relations = await kg.traverse('user_lord', 1);
    assert.ok(relations.length >= 1);
    const neighbor = relations.find(r => r.node.id === 'tech_ts');
    assert.ok(neighbor);
    assert.strictEqual(neighbor.node.label, 'TypeScript');
  });

  it('3. Long-Term Learning & Adaptation Rules', async () => {
    const engine = new LearningEngine();
    await engine.init();

    await engine.recordFailure({
      taskId: 'task_1',
      taskName: 'Search Docs',
      toolSlug: 'search_knowledge',
      errorMessage: 'ENOTDIR: not a directory',
      timestamp: new Date().toISOString(),
    });

    const rules = engine.getAdaptationRules();
    assert.ok(rules.length > 0);
  });
});

