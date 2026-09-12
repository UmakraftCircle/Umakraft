import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { ToolResult } from '../../services/tools/tool-result.js';
import { defaultTrainerDataProvider, ITrainerDataProvider } from './trainer-types.js';

export class TrainerLookupTool implements LilyTool {
  public name = 'TrainerLookupTool';

  constructor(private dataProvider: ITrainerDataProvider = defaultTrainerDataProvider) {}

  public canHandle(analysis: LanguageAnalysis): boolean {
    return analysis.intent === 'trainer_lookup';
  }

  public async execute(context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const explicitTrainerId =
        context.language?.trainerId ||
        context.language?.entities?.find(e => e.type === 'trainer_id')?.value ||
        context.trainerId;

      if (!explicitTrainerId) {
        return {
          success: false,
          error: 'Please provide a Trainer ID to look up.'
        };
      }

      const profile = await this.dataProvider.lookupTrainer(explicitTrainerId);
      if (profile) {
        return {
          success: true,
          data: profile
        };
      }

      return {
        success: true,
        data: {
          trainerId: explicitTrainerId,
          trainerName: 'Unknown',
          linked: false,
          notFound: true
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to lookup trainer'
      };
    }
  }
}
