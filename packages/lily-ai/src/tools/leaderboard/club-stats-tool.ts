import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { ToolResult } from '../../services/tools/tool-result.js';
import {
  defaultLeaderboardDataProvider,
  ILeaderboardDataProvider,
  ClubStatsResult
} from './leaderboard-types.js';

export class ClubStatsTool implements LilyTool {
  public name = 'ClubStatsTool';

  constructor(private dataProvider: ILeaderboardDataProvider = defaultLeaderboardDataProvider) {}

  public canHandle(analysis: LanguageAnalysis): boolean {
    return analysis.intent === 'club_stats';
  }

  public async execute(_context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const stats: ClubStatsResult = await this.dataProvider.getClubStats();
      return {
        success: true,
        data: stats
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to retrieve club statistics.'
      };
    }
  }
}
