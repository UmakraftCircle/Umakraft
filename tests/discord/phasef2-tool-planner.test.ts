import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planToolUsage, executeToolPlan } from '../../apps/discord/src/tool-planner.js';
import { agentToolRegistry } from '../../apps/discord/src/tool-registry.js';

describe('Phase F2 — Autonomous Tool Selection Engine Tests', () => {
  it('1. Tool Registry contains all required agent tools', () => {
    const webSearchTool = agentToolRegistry.getTool('WEB_SEARCH');
    const fanSystemTool = agentToolRegistry.getTool('FAN_SYSTEM');
    const leaderboardTool = agentToolRegistry.getTool('LEADERBOARD_SYSTEM');
    const handbookTool = agentToolRegistry.getTool('HANDBOOK_SEARCH');

    assert.ok(webSearchTool);
    assert.ok(fanSystemTool);
    assert.ok(leaderboardTool);
    assert.ok(handbookTool);
  });

  it('2. Plans "Tell me about Smart Falcon" -> Tool: NONE', async () => {
    const plan = await planToolUsage({
      userId: 'test-user-1',
      message: 'Tell me about Smart Falcon',
    });
    assert.equal(plan.selectedTool, 'NONE');
  });

  it('3. Plans "Show my fan gain" -> Tool: FAN_SYSTEM', async () => {
    const plan = await planToolUsage({
      userId: 'test-user-1',
      message: 'Show my fan gain',
    });
    assert.equal(plan.selectedTool, 'FAN_SYSTEM');
  });

  it('4. Plans "Top trainers" -> Tool: LEADERBOARD_SYSTEM', async () => {
    const plan = await planToolUsage({
      userId: 'test-user-1',
      message: 'Top trainers',
    });
    assert.equal(plan.selectedTool, 'LEADERBOARD_SYSTEM');
  });

  it('5. Plans "Latest Umamusume Global update" -> Tool: WEB_SEARCH', async () => {
    const plan = await planToolUsage({
      userId: 'test-user-1',
      message: 'Latest Umamusume Global update',
    });
    assert.equal(plan.selectedTool, 'WEB_SEARCH');
  });

  it('6. Plans "Explain the linking process" -> Tool: LINK_REQUEST_SYSTEM', async () => {
    const plan = await planToolUsage({
      userId: 'test-user-1',
      message: 'link my account',
    });
    assert.equal(plan.selectedTool, 'LINK_REQUEST_SYSTEM');
  });

  it('7. Executes tool plan with standard contract and failure recovery', async () => {
    const plan = await planToolUsage({
      userId: 'test-user-1',
      message: 'Show my fan gain',
    });

    const result = await executeToolPlan(plan, async () => {
      return { fansGained: 1500000 };
    });

    assert.equal(result.success, true);
    assert.equal(result.source, 'FAN_SYSTEM');
    assert.deepEqual(result.data, { fansGained: 1500000 });
  });

  it('8. Handles failing tool execution gracefully without throwing', async () => {
    const plan = await planToolUsage({
      userId: 'test-user-1',
      message: 'Latest Umamusume Global update',
    });

    const result = await executeToolPlan(plan, async () => {
      throw new Error('Tavily API rate limit exceeded');
    });

    assert.equal(result.success, false);
    assert.equal(result.source, 'WEB_SEARCH');
    assert.equal(result.error, 'Tavily API rate limit exceeded');
  });
});
