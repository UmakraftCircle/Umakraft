import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiPlanner } from '../../apps/discord/src/tools/ai-planner.js';
import { toolRegistry } from '../../apps/discord/src/tools/tool-registry.js';
import { IntentType } from '../../apps/discord/src/intent-router.js';

describe('H3 — Tool Agent Framework Tests', () => {
  it('1. AI Planner correctly plans FanGainTool for fan gain queries', () => {
    const tools = aiPlanner.plan(IntentType.FAN_SYSTEM, 'What is my fan gain today?');
    assert.ok(tools.includes('FanGainTool'));
  });

  it('2. AI Planner correctly plans LeaderboardTool for leaderboard queries', () => {
    const tools = aiPlanner.plan(IntentType.LEADERBOARD, 'Show me the club leaderboard');
    assert.ok(tools.includes('LeaderboardTool'));
  });

  it('3. ToolRegistry successfully executes registered tools', () => {
    const tool = toolRegistry.getTool('FanGainTool');
    assert.ok(tool);
    const result = tool.execute({
      trainerId: 'trainer-h3-1',
      query: 'fans',
      intent: IntentType.FAN_SYSTEM,
    });
    assert.equal(result.success, true);
    assert.ok(result.data.dailyGain !== undefined);
  });
});
