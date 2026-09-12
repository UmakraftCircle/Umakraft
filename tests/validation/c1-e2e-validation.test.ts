import { test } from 'node:test';
import assert from 'node:assert';
import { LilyOrchestrator } from '../../packages/lily-ai/src/orchestrator/lily-orchestrator.js';
import { LilyLanguageService } from '../../packages/lily-ai/src/services/language/lily-language-service.js';
import { LilyMemoryService } from '../../packages/lily-ai/src/services/memory/lily-memory-service.js';
import { LilyToolService } from '../../packages/lily-ai/src/services/tools/lily-tool-service.js';
import { LilyKnowledgeService } from '../../packages/lily-ai/src/services/knowledge/lily-knowledge-service.js';
import { IChatService } from '../../packages/lily-ai/src/services/chat/index.js';
import { ToolRegistry } from '../../packages/lily-ai/src/services/tools/tool-registry.js';
import { LilyTool, ToolResult } from '../../packages/lily-ai/src/services/tools/index.js';

// --- MOCKS ---

class MockFanGainTool implements LilyTool {
  public name = 'FanGainTool';
  public canHandle(analysis: any) { return analysis.intent === 'fan_gain'; }
  async execute(context: any): Promise<ToolResult> {
    return { success: true, data: { gainedToday: 1500000, totalFans: 150000000 } };
  }
}

class MockTrainerProfileTool implements LilyTool {
  public name = 'TrainerProfileTool';
  public canHandle(analysis: any) { return analysis.intent === 'trainer_profile'; }
  async execute(context: any): Promise<ToolResult> {
    return { success: true, data: { trainerId: '123456', trainerName: 'TestTrainer', linked: true } };
  }
}

class MockMemberRankTool implements LilyTool {
  public name = 'MemberRankTool';
  public canHandle(analysis: any) { return analysis.intent === 'member_rank'; }
  async execute(context: any): Promise<ToolResult> {
    return { success: true, data: { rank: 1, totalMembers: 30, fans: 150000000 } };
  }
}

class MockLinkRequestTool implements LilyTool {
  public name = 'LinkRequestTool';
  public canHandle(analysis: any) { return analysis.intent === 'link_request'; }
  async execute(context: any): Promise<ToolResult> {
    return { success: true, data: { requestId: 'req_123', status: 'pending' } };
  }
}

// Simple Chat Service Mock
class ChatServiceMock implements IChatService {
  async generateResponse(context: any): Promise<string> {
    if (context.toolResult && !context.toolResult.success) {
      return "Tool error";
    }
    return "Response";
  }
}

const languageService = new LilyLanguageService();
const memoryService = new LilyMemoryService();
const knowledgeService = new LilyKnowledgeService();
const toolRegistry = new ToolRegistry([
    new MockFanGainTool(),
    new MockTrainerProfileTool(),
    new MockMemberRankTool(),
    new MockLinkRequestTool()
]);
const toolService = new LilyToolService(toolRegistry);
const chatService = new ChatServiceMock();

const orchestrator = new LilyOrchestrator(
  languageService,
  memoryService,
  toolService,
  knowledgeService,
  chatService
);

// --- TESTS ---

test('C1 — End-to-End Validation', async (t) => {
  const userId = 'val-user-1';

  await t.test('Scenario 1 — Fan System', async () => {
    const res = await orchestrator.execute({ userId, message: "How much fan did I gain today?" });
    assert.strictEqual(res.success, true);
  });

  await t.test('Scenario 2 — Trainer Profile', async () => {
    const res = await orchestrator.execute({ userId, message: "Show my profile" });
    assert.strictEqual(res.success, true);
  });

  await t.test('Scenario 3 — Leaderboard', async () => {
    const res = await orchestrator.execute({ userId, message: "What rank am I?" });
    assert.strictEqual(res.success, true);
  });
});
