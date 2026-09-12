import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { ToolResult } from '../../services/tools/tool-result.js';
import {
  defaultLeaderboardDataProvider,
  ILeaderboardDataProvider,
  MemberRankResult
} from './leaderboard-types.js';
import {
  defaultTrainerDataProvider,
  ITrainerDataProvider
} from '../trainer/trainer-types.js';

export class MemberRankTool implements LilyTool {
  public name = 'MemberRankTool';

  constructor(
    private dataProvider: ILeaderboardDataProvider = defaultLeaderboardDataProvider,
    private trainerProvider: ITrainerDataProvider = defaultTrainerDataProvider
  ) {}

  public canHandle(analysis: LanguageAnalysis): boolean {
    return analysis.intent === 'member_rank';
  }

  public async execute(context: ToolExecutionContext): Promise<ToolResult> {
    try {
      // 1. Resolve explicit trainer ID from message
      const explicitTrainerId =
        context.language?.trainerId ||
        context.language?.entities?.find(e => e.type === 'trainer_id')?.value;

      // 2. Resolve trainer ID from B2 memory context
      const memoryTrainerId = context.memory?.trainerId;

      // 3. Resolve linked trainer ID from database / provider
      let linkedTrainerId: string | undefined;
      if (context.userId) {
        const linkStatus = await this.trainerProvider.getLinkStatus(context.userId);
        if (linkStatus.linked && linkStatus.trainerId) {
          linkedTrainerId = linkStatus.trainerId;
        }
      }

      // 4. Fallback trainer ID from execution context
      const fallbackTrainerId =
        context.trainerId && context.trainerId !== context.userId
          ? context.trainerId
          : undefined;

      let resolvedTrainerId =
        explicitTrainerId || memoryTrainerId || linkedTrainerId || fallbackTrainerId;

      if (!resolvedTrainerId && context.userId) {
        const members = this.dataProvider.getMembers ? await this.dataProvider.getMembers() : [];
        const matched = members.find(m => m.linkedDiscordId === context.userId);
        if (matched) {
          resolvedTrainerId = matched.trainerId;
        }
      }

      // Missing trainer context -> return unlinked notice
      if (!resolvedTrainerId) {
        return {
          success: true,
          data: {
            unlinkedNotice: true,
            notFound: true,
            message: "Trainer, I couldn't find a linked trainer profile. You can start a link request anytime."
          } as MemberRankResult
        };
      }

      // 5. Query ranking from leaderboard data provider
      const rankResult = await this.dataProvider.getMemberRank(resolvedTrainerId);

      if (rankResult) {
        return {
          success: true,
          data: rankResult
        };
      }

      // Trainer identity is known, but record is absent from club roster
      return {
        success: true,
        data: {
          notFound: true,
          trainerId: resolvedTrainerId,
          message: "Trainer, I couldn't find your record in the club rankings."
        } as MemberRankResult
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to determine member rank.'
      };
    }
  }
}
