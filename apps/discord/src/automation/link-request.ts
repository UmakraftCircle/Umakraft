import type { Client, Message } from 'discord.js';
import { trainerLinkStore, linkRequestStore } from '@ai-agent-platform/integrations';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Automation-LinkRequest');

export type LinkStep = 'WAITING_FOR_TRAINER_ID' | 'WAITING_FOR_TRAINER_NAME';

export interface ActiveLinkSession {
  discordUserId: string;
  discordUsername: string;
  step: LinkStep;
  trainerId?: string;
  trainerName?: string;
  updatedAt: number;
}

// In-memory collection session store (timeout after 15 minutes)
const activeSessions = new Map<string, ActiveLinkSession>();
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export class LinkRequestService {
  private static instance: LinkRequestService;

  public static getInstance(): LinkRequestService {
    if (!LinkRequestService.instance) {
      LinkRequestService.instance = new LinkRequestService();
    }
    return LinkRequestService.instance;
  }

  /**
   * Checks if a user has an active DM link collection session.
   */
  public hasActiveSession(userId: string): boolean {
    const session = activeSessions.get(userId);
    if (!session) return false;
    if (Date.now() - session.updatedAt > SESSION_TIMEOUT_MS) {
      activeSessions.delete(userId);
      return false;
    }
    return true;
  }

  /**
   * Cancels/clears an active link session for a user.
   */
  public cancelSession(userId: string): void {
    activeSessions.delete(userId);
  }

  /**
   * Fetches pending link requests.
   */
  public async getPendingRequests(): Promise<any[]> {
    try {
      return await linkRequestStore.getAllPending();
    } catch (err: any) {
      logger.warn(`Failed fetching pending requests: ${err?.message}`);
      return [];
    }
  }

  /**
   * Initiates a new Link Request process for a user.
   */
  public async initiateLinkRequest(userId: string, username: string): Promise<string> {
    // 1. Check if user is already linked
    try {
      const existingLink = await trainerLinkStore.getByDiscordUser(userId);
      if (existingLink) {
        return [
          'ℹ️ Already Linked',
          '',
          `Your Discord account is already linked to:`,
          `Trainer Name: ${existingLink.trainerName}`,
          `Trainer ID: ${existingLink.trainerId}`,
        ].join('\n');
      }
    } catch (err: any) {
      logger.warn(`Failed checking existing link for ${userId}: ${err?.message}`);
    }

    // 2. Prevent duplicate pending/forwarded requests
    try {
      const existingReq = await linkRequestStore.getPendingOrForwarded(userId);
      if (existingReq) {
        return [
          'ℹ️ Link Request Pending',
          '',
          `You already have a pending link request forwarded to the Club Leader.`,
          `Trainer Name: ${existingReq.trainerName}`,
          `Trainer ID: ${existingReq.trainerId}`,
          '',
          'Please wait for the leader to complete the linking process manually.',
        ].join('\n');
      }
    } catch (err: any) {
      logger.warn(`Failed checking existing link requests for ${userId}: ${err?.message}`);
    }

    // 3. Start Link Session (Step 1: Ask Trainer ID)
    activeSessions.set(userId, {
      discordUserId: userId,
      discordUsername: username,
      step: 'WAITING_FOR_TRAINER_ID',
      updatedAt: Date.now(),
    });

    return [
      '🔗 Trainer Link Request',
      '',
      'Please provide your Trainer ID.',
    ].join('\n');
  }

  /**
   * Handles subsequent step responses from the user in DM.
   */
  public async handleStepResponse(
    message: Message,
    client?: Client
  ): Promise<string | null> {
    const userId = message.author.id;
    const session = activeSessions.get(userId);
    if (!session) return null;

    const input = (message.content ?? '').trim();
    if (!input) return null;

    // Handle cancel command
    if (input.toLowerCase() === 'cancel' || input.toLowerCase() === 'stop') {
      activeSessions.delete(userId);
      return 'Link request cancelled.';
    }

    if (session.step === 'WAITING_FOR_TRAINER_ID') {
      session.trainerId = input;
      session.step = 'WAITING_FOR_TRAINER_NAME';
      session.updatedAt = Date.now();

      return 'Please provide your Trainer Name.';
    }

    if (session.step === 'WAITING_FOR_TRAINER_NAME') {
      session.trainerName = input;
      const trainerId = session.trainerId || 'Unknown';
      const trainerName = session.trainerName;
      const username = message.author.username || session.discordUsername || 'Trainer';

      // 1. Save in link_requests database table
      const requestRecord = await linkRequestStore.create({
        discordUserId: userId,
        discordUsername: username,
        trainerId,
        trainerName,
      });

      // 2. Clear active session
      activeSessions.delete(userId);

      // 3. Format user confirmation message
      const userMessage = [
        '✅ Link Request Submitted',
        '',
        `Trainer Name: ${trainerName}`,
        `Trainer ID: ${trainerId}`,
        '',
        'Your request has been forwarded to the Club Leader.',
        'Please wait for the leader to complete the linking process.',
      ].join('\n');

      // 4. Send notification to Club Leader(s) or Staff channel
      await this.notifyClubLeaders(client, {
        discordUserId: userId,
        discordUsername: username,
        trainerId,
        trainerName,
        requestedAt: requestRecord.requestedAt,
      });

      return userMessage;
    }

    return null;
  }

  /**
   * Forwards formatted notification to Club Leader(s) / Staff.
   */
  private async notifyClubLeaders(
    client: Client | undefined,
    data: {
      discordUserId: string;
      discordUsername: string;
      trainerId: string;
      trainerName: string;
      requestedAt: string;
    }
  ): Promise<void> {
    if (!client) {
      logger.warn('[LinkNotice] Client not available to forward notice to Club Leader.');
      return;
    }

    // Convert requestedAt date to UTC string (YYYY-MM-DD HH:mm UTC)
    const reqDate = new Date(data.requestedAt);
    const utcTimeStr = `${reqDate.getUTCFullYear()}-${String(reqDate.getUTCMonth() + 1).padStart(2, '0')}-${String(reqDate.getUTCDate()).padStart(2, '0')} ${String(reqDate.getUTCHours()).padStart(2, '0')}:${String(reqDate.getUTCMinutes()).padStart(2, '0')} UTC`;

    const leaderNoticeText = [
      '🔔 LINK REQUEST NOTICE',
      '',
      'Discord User:',
      `@${data.discordUsername}`,
      '',
      'Discord ID:',
      data.discordUserId,
      '',
      'Trainer Name:',
      data.trainerName,
      '',
      'Trainer ID:',
      data.trainerId,
      '',
      'Request Time:',
      utcTimeStr,
      '',
      'This is a notification only.',
      'Please perform the trainer linking process manually.',
    ].join('\n');

    logger.info(`[LinkNotice] Created notice for Leader:\n${leaderNoticeText}`);

    // Retrieve leader user IDs from env or default targets
    const leaderEnv = process.env['CLUB_LEADER_DISCORD_IDS'] || process.env['STAFF_DISCORD_IDS'] || '';
    const leaderUserIds = leaderEnv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let deliveredCount = 0;

    for (const leaderId of leaderUserIds) {
      try {
        const leaderUser = await client.users.fetch(leaderId).catch(() => null);
        if (leaderUser) {
          await leaderUser.send(leaderNoticeText);
          deliveredCount++;
          logger.info(`[LinkNotice] Notice DM delivered to Club Leader @${leaderUser.tag} (${leaderId})`);
        }
      } catch (err: any) {
        logger.warn(`Failed sending link request notice to Leader ${leaderId}: ${err?.message}`);
      }
    }

    // Fallback if no specific env leaders configured: check guild owners/bot admins
    if (deliveredCount === 0) {
      try {
        for (const guild of client.guilds.cache.values()) {
          if (guild.ownerId) {
            const owner = await client.users.fetch(guild.ownerId).catch(() => null);
            if (owner) {
              await owner.send(leaderNoticeText).catch(() => null);
              logger.info(`[LinkNotice] Notice DM delivered to Guild Owner @${owner.tag} (${guild.ownerId})`);
              deliveredCount++;
            }
          }
        }
      } catch (fallbackErr: any) {
        logger.warn(`Leader notice fallback delivery error: ${fallbackErr?.message}`);
      }
    }
  }
}

export const linkRequestService = LinkRequestService.getInstance();
