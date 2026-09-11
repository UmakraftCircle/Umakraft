import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('LinkService');

export class LinkService {
  private static instance: LinkService;
  private links: Map<string, string> = new Map(); // discordUserId -> trainerId

  public static getInstance(): LinkService {
    if (!LinkService.instance) {
      LinkService.instance = new LinkService();
    }
    return LinkService.instance;
  }

  public createRequest(discordUserId: string, trainerId: string): boolean {
    this.links.set(discordUserId, trainerId);
    logger.info(`[LinkService] Linked discord user ${discordUserId} to trainer ID ${trainerId}`);
    return true;
  }

  public getTrainerId(discordUserId: string): string | undefined {
    return this.links.get(discordUserId);
  }
}

export const linkService = LinkService.getInstance();
