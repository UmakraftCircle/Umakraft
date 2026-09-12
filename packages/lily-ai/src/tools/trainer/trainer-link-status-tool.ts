import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { ToolResult } from '../../services/tools/tool-result.js';
import { defaultTrainerDataProvider, ITrainerDataProvider } from './trainer-types.js';

export class TrainerLinkStatusTool implements LilyTool {
  public name = 'TrainerLinkStatusTool';

  constructor(private dataProvider: ITrainerDataProvider = defaultTrainerDataProvider) {}

  public canHandle(analysis: LanguageAnalysis): boolean {
    return analysis.intent === 'trainer_link_status';
  }

  public async execute(context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const targetUserId = context.userId || context.memory?.trainerId || context.trainerId || '';
      const status = await this.dataProvider.getLinkStatus(targetUserId);

      return {
        success: true,
        data: status
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to check trainer link status'
      };
    }
  }
}
