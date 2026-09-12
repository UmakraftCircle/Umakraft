import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { ToolResult } from '../../services/tools/tool-result.js';
import {
  defaultLeaderboardDataProvider,
  ILeaderboardDataProvider,
  LeaderboardResult
} from './leaderboard-types.js';

export class LeaderboardTool implements LilyTool {
  public name = 'LeaderboardTool';

  constructor(private dataProvider: ILeaderboardDataProvider = defaultLeaderboardDataProvider) {}

  public canHandle(analysis: LanguageAnalysis): boolean {
    return (
      analysis.intent === 'leaderboard' ||
      analysis.intent === 'top_members' ||
      analysis.intent === 'fan_leaderboard'
    );
  }

  public async execute(context: ToolExecutionContext): Promise<ToolResult> {
    try {
      let limit: number | undefined = undefined;
      const msg = context.language?.normalizedMessage || '';

      if (context.language?.intent === 'top_members') {
        const numEntity = context.language?.entities?.find(e => e.type === 'number');
        if (numEntity) {
          const parsed = parseInt(numEntity.value, 10);
          if (!isNaN(parsed) && parsed > 0) {
            limit = parsed;
          }
        } else if (msg.includes('top 10') || msg.includes('10')) {
          limit = 10;
        } else if (msg.includes('top 5') || msg.includes('5')) {
          limit = 5;
        } else if (msg.includes('top 3') || msg.includes('3')) {
          limit = 3;
        } else {
          limit = 10;
        }
      } else if (msg.includes('top 5')) {
        limit = 5;
      } else if (msg.includes('top 10')) {
        limit = 10;
      } else {
        limit = 5;
      }

      const result: LeaderboardResult = await this.dataProvider.getLeaderboard(limit);

      return {
        success: true,
        data: result
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to retrieve club leaderboard.'
      };
    }
  }
}
