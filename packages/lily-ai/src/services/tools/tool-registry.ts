import { LilyTool } from './tool-selection.js';
import { LanguageAnalysis } from '../language/language-analysis.js';
import {
  FanGainTool,
  FanDeficitTool,
  FanSurplusTool,
  FanProjectionTool,
  FanMilestoneTool
} from '../../tools/fan/index.js';
import {
  TrainerProfileTool,
  TrainerLinkStatusTool,
  TrainerLookupTool
} from '../../tools/trainer/index.js';
import {
  LinkRequestTool,
  LinkStatusTool
} from '../../tools/link/index.js';
import { HandbookLookupTool } from '../../tools/handbook/handbook-lookup-tool.js';
import { ParentSearchTool } from '../../tools/parent/parent-search-tool.js';
import {
  LeaderboardTool,
  MemberRankTool,
  ClubStatsTool
} from '../../tools/leaderboard/index.js';

export {
  FanGainTool,
  FanDeficitTool,
  FanSurplusTool,
  FanProjectionTool,
  FanMilestoneTool,
  TrainerProfileTool,
  TrainerLinkStatusTool,
  TrainerLookupTool,
  LeaderboardTool,
  MemberRankTool,
  ClubStatsTool,
  HandbookLookupTool,
  ParentSearchTool,
  LinkRequestTool,
  LinkStatusTool
};

export class TrainerStatsTool implements LilyTool {
  name = 'TrainerStatsTool';
  canHandle(analysis: LanguageAnalysis) {
    return analysis.intent === 'trainer_stats' || analysis.intent === 'trainer_search';
  }
}

export class LinkHelpTool implements LilyTool {
  name = 'LinkHelpTool';
  canHandle(analysis: LanguageAnalysis) {
    return analysis.intent === 'link_help';
  }
}

export class ToolRegistry {
  private tools: LilyTool[];

  constructor(customTools?: LilyTool[]) {
    this.tools = customTools || [
      new TrainerProfileTool(),
      new TrainerLinkStatusTool(),
      new TrainerLookupTool(),
      new FanGainTool(),
      new FanDeficitTool(),
      new FanSurplusTool(),
      new FanProjectionTool(),
      new FanMilestoneTool(),
      new LeaderboardTool(),
      new MemberRankTool(),
      new ClubStatsTool(),
      new ParentSearchTool(),
      new TrainerStatsTool(),
      new LinkRequestTool(),
      new LinkStatusTool(),
      new LinkHelpTool(),
      new HandbookLookupTool()
    ];
  }

  public getTools(): LilyTool[] {
    return this.tools;
  }

  public registerTool(tool: LilyTool) {
    this.tools.push(tool);
  }

  public getTool(name: string): LilyTool | undefined {
    return this.tools.find(t => t.name === name);
  }
}
