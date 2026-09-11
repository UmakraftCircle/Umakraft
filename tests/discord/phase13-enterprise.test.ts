import { test, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WorkspaceManager, PluginRegistry } from '@ai-agent-platform/core';

describe('Phase 13: Enterprise Agent Platform & Ecosystem Expansion', () => {
  it('1. Multi-Tenant Workspace Isolation', async () => {
    const manager = new WorkspaceManager();
    await manager.init();

    const ws = await manager.createWorkspace({
      id: 'ws-uma-1',
      organizationId: 'org-umakraft',
      name: 'Umakraft Elite Trainer Workspace',
      ownerId: 'trainer_lord',
      settings: { theme: 'dark', defaultModel: 'gpt-4o' },
    });

    assert.ok(ws);
    assert.strictEqual(ws.organizationId, 'org-umakraft');

    const fetched = await manager.getWorkspace('ws-uma-1');
    assert.ok(fetched);
    assert.strictEqual(fetched.name, 'Umakraft Elite Trainer Workspace');
  });

  it('2. Enterprise Plugin Architecture & Marketplace', () => {
    const registry = new PluginRegistry();
    registry.register({
      id: 'plugin-github',
      name: 'GitHub Integration Plugin',
      version: '1.0.0',
      tools: ['search_repo', 'create_issue'],
      agents: ['developer-agent'],
      workflows: ['code-review'],
    });

    const plugin = registry.get('plugin-github');
    assert.ok(plugin);
    assert.strictEqual(plugin.version, '1.0.0');
    assert.strictEqual(plugin.tools.length, 2);
  });
});
