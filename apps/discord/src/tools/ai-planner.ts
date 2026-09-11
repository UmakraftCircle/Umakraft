import { createLogger } from '@ai-agent-platform/shared';
import { IntentType } from '../intent-router.js';
import { toolRegistry } from './tool-registry.js';

const logger = createLogger('AIPlanner');

export class AIPlanner {
  private static instance: AIPlanner;

  public static getInstance(): AIPlanner {
    if (!AIPlanner.instance) {
      AIPlanner.instance = new AIPlanner();
    }
    return AIPlanner.instance;
  }

  public plan(intent: IntentType, query: string): string[] {
    const lower = (query || '').toLowerCase();
    const selectedTools: string[] = [];

    // Multi-tool or intent-based mapping
    if (intent === IntentType.FAN_SYSTEM || lower.includes('fan') || lower.includes('gain')) {
      selectedTools.push('FanGainTool');
    }
    if (intent === IntentType.LEADERBOARD || lower.includes('rank') || lower.includes('leaderboard')) {
      selectedTools.push('LeaderboardTool');
    }
    if (intent === IntentType.HANDBOOK || lower.includes('rule') || lower.includes('handbook') || lower.includes('requirement')) {
      selectedTools.push('HandbookTool');
    }
    if (intent === IntentType.LINK_REQUEST || lower.includes('link') || lower.includes('id')) {
      selectedTools.push('LinkRequestTool');
    }
    if (intent === IntentType.WEB_SEARCH || lower.includes('patch') || lower.includes('update')) {
      selectedTools.push('WebSearchTool');
    }

    if (selectedTools.length === 0) {
      const fallbackTool = toolRegistry.getToolForIntent(intent);
      if (fallbackTool && fallbackTool !== 'CHAT') {
        selectedTools.push(fallbackTool);
      }
    }

    logger.info(`[AIPlanner] Planned tools for intent ${intent}: [${selectedTools.join(', ')}]`);
    return selectedTools;
  }
}

export const aiPlanner = AIPlanner.getInstance();
