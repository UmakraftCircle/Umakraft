import { trainerLinkStore } from '../../../../integrations/src/trainer-links.js';
import { linkRequestStore } from '../../../../integrations/src/link-requests.js';

import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { LinkStatusResult } from './link-types.js';

export class LinkStatusTool implements LilyTool {
  name = 'LinkStatusTool';

  canHandle(analysis: LanguageAnalysis): boolean {
    return analysis.intent === 'link_status';
  }

  public async execute(context: ToolExecutionContext): Promise<LinkStatusResult> {
    if (!context.userId) {
      return { 
        success: true,
        data: { linked: false, status: 'none' } 
      };
    }

    // 1. Check approved link
    const link = await trainerLinkStore.getByDiscordUser(context.userId);
    if (link) {
      return {
        success: true,
        data: {
          linked: true,
          status: 'approved',
          trainerId: link.trainerId,
          trainerName: link.trainerName
        }
      };
    }

    // 2. Check pending request
    const pending = await linkRequestStore.getPendingOrForwarded(context.userId);
    if (pending) {
      return {
        success: true,
        data: {
          linked: false,
          status: 'pending',
          trainerId: pending.trainerId,
          trainerName: pending.trainerName
        }
      };
    }

    return {
      success: true,
      data: {
        linked: false,
        status: 'none'
      }
    };
  }
}
