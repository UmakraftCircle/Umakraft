import { createLogger } from '@ai-agent-platform/shared';
import { IntentType } from './intent-router.js';
import { fanService } from './domain/fan-service.js';
import { leaderboardService } from './domain/leaderboard-service.js';
import { handbookService } from './domain/handbook-service.js';
import { linkService } from './domain/link-service.js';

const logger = createLogger('ToolExecutionService');

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data: any;
  durationMs: number;
  error?: string;
}

export class ToolExecutionService {
  private static instance: ToolExecutionService;

  public static getInstance(): ToolExecutionService {
    if (!ToolExecutionService.instance) {
      ToolExecutionService.instance = new ToolExecutionService();
    }
    return ToolExecutionService.instance;
  }

  public execute(intent: IntentType, trainerId: string, query: string): ToolExecutionResult {
    const start = Date.now();
    try {
      switch (intent) {
        case IntentType.FAN_SYSTEM: {
          const stats = fanService.getFanStats(trainerId);
          return { toolName: 'FanGainTool', success: true, data: stats, durationMs: Date.now() - start };
        }
        case IntentType.LEADERBOARD: {
          const rank = leaderboardService.getRank(trainerId);
          const top = leaderboardService.getTop10();
          return { toolName: 'LeaderboardTool', success: true, data: { rank, top }, durationMs: Date.now() - start };
        }
        case IntentType.HANDBOOK: {
          const rules = handbookService.search(query);
          return { toolName: 'HandbookTool', success: true, data: rules, durationMs: Date.now() - start };
        }
        case IntentType.LINK_REQUEST: {
          const existing = linkService.getTrainerId(trainerId);
          return { toolName: 'LinkRequestTool', success: true, data: { linkedTrainerId: existing }, durationMs: Date.now() - start };
        }
        default:
          return { toolName: 'None', success: true, data: null, durationMs: Date.now() - start };
      }
    } catch (err: any) {
      return { toolName: 'ErrorTool', success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}

export const toolExecutionService = ToolExecutionService.getInstance();
