import { trainerLinkStore } from '../../../../integrations/src/trainer-links.js';
import { linkRequestStore } from '../../../../integrations/src/link-requests.js';

import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { LinkRequestResult } from './link-types.js';

export class LinkRequestTool implements LilyTool {
  name = 'LinkRequestTool';

  canHandle(analysis: LanguageAnalysis): boolean {
    return analysis.intent === 'link_request';
  }

  public async execute(context: ToolExecutionContext): Promise<LinkRequestResult> {
    if (!context.userId) {
      return { success: false, error: 'User ID is required' };
    }

    // 1. Check if already linked
    const existingLink = await trainerLinkStore.getByDiscordUser(context.userId);
    if (existingLink) {
      return { 
        success: true, 
        data: {
          alreadyLinked: true, 
          trainerId: existingLink.trainerId,
          status: 'pending' 
        }
      };
    }

    // 2. Check if already has a pending request
    const pendingRequest = await linkRequestStore.getPendingOrForwarded(context.userId);
    if (pendingRequest) {
      return {
        success: true,
        data: {
          requestId: pendingRequest.id,
          status: 'pending'
        }
      };
    }

    // 3. Resolve trainerId/trainerName from memory or language entities if not explicitly in context
    // Ignore trainerId if it's the same as userId (orchestrator default)
    let trainerId = context.trainerId === context.userId ? undefined : context.trainerId;
    let trainerName = context.trainerName;

    if (!trainerId && context.language?.entities) {
      trainerId = context.language.entities.find(e => e.type === 'trainer_id')?.value;
    }
    if (!trainerId && context.memory?.trainerId) {
      trainerId = context.memory.trainerId;
    }
    if (!trainerName && context.memory?.trainerName) {
      trainerName = context.memory.trainerName;
    }

    // 4. Validate fields
    const missingFields: string[] = [];
    if (!trainerId) missingFields.push('Trainer ID');
    if (!trainerName) missingFields.push('Trainer Name');

    if (missingFields.length > 0) {
      return {
        success: true,
        data: {
          missingFields
        }
      };
    }

    // 5. Create request
    const newRequest = await linkRequestStore.create({
      discordUserId: context.userId,
      discordUsername: context.username || 'unknown',
      trainerId: trainerId!,
      trainerName: trainerName!
    });

    return {
      success: true,
      data: {
        requestId: newRequest.id,
        status: 'pending'
      }
    };
  }
}
