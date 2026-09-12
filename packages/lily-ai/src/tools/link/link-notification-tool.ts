import { LeaderLinkNotification } from './link-types.js';

export class LinkNotificationTool {
  public static formatLeaderNotification(notification: LeaderLinkNotification): string {
    return `**New Link Request**

Discord User: <@${notification.discordUserId}>
Trainer Name: ${notification.trainerName}
Trainer ID: ${notification.trainerId}

Request ID: ${notification.requestId}
Submitted: ${notification.submittedAt.toLocaleString()}`;
  }
}
