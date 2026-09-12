import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { ToolResult } from '../../services/tools/tool-result.js';
import { FanCalculator } from './fan-calculator.js';
import { defaultFanDataProvider, IFanDataProvider } from './fan-types.js';

export class FanGainTool implements LilyTool {
  public name = 'FanGainTool';

  constructor(private dataProvider: IFanDataProvider = defaultFanDataProvider) {}

  public canHandle(analysis: LanguageAnalysis): boolean {
    return analysis.intent === 'fan_gain' || analysis.intent === 'fan_query';
  }

  public async execute(context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const id = context.trainerId || context.userId || 'default-trainer';
      const data = await this.dataProvider.getTrainerFanData(id);
      const result = FanCalculator.calculateGain(data);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to calculate fan gain'
      };
    }
  }
}
