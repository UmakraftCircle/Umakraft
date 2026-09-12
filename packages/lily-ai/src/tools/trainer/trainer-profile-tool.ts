import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { ToolResult } from '../../services/tools/tool-result.js';
import { defaultTrainerDataProvider, ITrainerDataProvider, TrainerProfileResult } from './trainer-types.js';

export class TrainerProfileTool implements LilyTool {
  public name = 'TrainerProfileTool';

  constructor(private dataProvider: ITrainerDataProvider = defaultTrainerDataProvider) {}

  public canHandle(analysis: LanguageAnalysis): boolean {
    return analysis.intent === 'trainer_profile';
  }

  public async execute(context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const explicitTrainerId =
        context.language?.trainerId ||
        context.language?.entities?.find(e => e.type === 'trainer_id')?.value;
      const memoryTrainerId = context.memory?.trainerId;
      const resolvedTrainerId = explicitTrainerId || memoryTrainerId || context.trainerId;

      let profile: TrainerProfileResult | null = null;

      if (resolvedTrainerId) {
        profile = await this.dataProvider.getProfile(resolvedTrainerId, context.userId);
      } else if (context.userId) {
        profile = await this.dataProvider.getProfile(context.userId, context.userId);
      }

      if (profile) {
        return {
          success: true,
          data: profile
        };
      }

      // If user stated/remembered a trainer ID that isn't registered with a custom name
      if (resolvedTrainerId && resolvedTrainerId !== context.userId) {
        return {
          success: true,
          data: {
            trainerId: resolvedTrainerId,
            trainerName: context.memory?.trainerName || 'Trainer',
            linked: false,
            clubName: context.memory?.clubName || 'None'
          }
        };
      }

      // If user is unlinked and no profile exists
      if (context.userId) {
        return {
          success: true,
          data: {
            trainerId: 'Unknown',
            trainerName: 'Unknown',
            linked: false,
            unlinkedNotice: true
          }
        };
      }

      return { success: false, error: 'User ID is required' };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to retrieve trainer profile'
      };
    }
  }
}
