import { createLogger } from '@ai-agent-platform/shared';
import { Tool, ToolContext, ToolResult } from './tool.interface.js';
import { leaderboardService } from '../domain/leaderboard-service.js';

const logger = createLogger('RankingTools');

export class LeaderboardTool implements Tool {
  public getName(): string {
    return 'LeaderboardTool';
  }

  public execute(context: ToolContext): ToolResult {
    const start = Date.now();
    try {
      const top = leaderboardService.getTop10();
      const rank = leaderboardService.getRank(context.trainerId);
      return {
        toolName: this.getName(),
        success: true,
        data: { rank, topTrainers: top },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { toolName: this.getName(), success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}
