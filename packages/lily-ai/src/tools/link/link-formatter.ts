import { LinkRequestResult, LinkStatusResult } from './link-types.js';

export class LinkFormatter {
  /**
   * Formats a link request result (the data portion of the tool result)
   */
  public static formatRequest(data: LinkRequestResult['data']): string {
    if (!data) return 'Trainer, I encountered an error while processing your link request.';

    if (data.alreadyLinked) {
      return `Trainer, your Discord account is already linked.\n\nTrainer ID: ${data.trainerId}`;
    }

    if (data.requestId) {
      return `Trainer, your link request has been submitted successfully.\n\n**Status: Pending Approval**\n\nA club leader will review your request.`;
    }

    if (data.missingFields && data.missingFields.length > 0) {
      return `I'd be happy to help you link your account! I'll need your **${data.missingFields.join(' and ')}** to proceed.`;
    }

    return 'Trainer, I encountered an error while processing your link request.';
  }

  /**
   * Formats a link status result (the data portion of the tool result)
   */
  public static formatStatus(data: LinkStatusResult['data']): string {
    if (!data) return 'Trainer, I encountered an error checking your link status.';

    if (data.linked) {
      return `Trainer, your Discord account is already linked.\n\nTrainer ID: ${data.trainerId}`;
    }

    if (data.status === 'pending') {
      return `Trainer, your link request is still pending review.\n\nPlease wait for a club leader to process it.`;
    }

    if (data.status === 'rejected') {
      return `Trainer, your link request was not approved. Please contact a club leader for more information.`;
    }

    return `Trainer, you don't have an active link request. Would you like me to start one for you?`;
  }
}
