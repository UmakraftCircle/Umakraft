import { ILinkRepository } from '../repositories/link-repository.js';
import { LinkRequestEntity } from '../repositories/repository-types.js';
import { DatabaseKnowledgeResult } from '../database-result.js';

export class LinkRequestKnowledgeModule {
  private linkRepository: ILinkRepository;

  constructor(linkRepository: ILinkRepository) {
    this.linkRepository = linkRepository;
  }

  public async getPendingRequests(limit: number = 50): Promise<LinkRequestEntity[]> {
    return this.linkRepository.findPending(limit);
  }

  public async createRequest(
    discordUserId: string,
    trainerId: string,
    trainerName: string
  ): Promise<LinkRequestEntity> {
    return this.linkRepository.createRequest(discordUserId, trainerId, trainerName);
  }

  public async lookupRequest(requestIdOrUserId: string): Promise<LinkRequestEntity | null> {
    let req = await this.linkRepository.findById(requestIdOrUserId);
    if (!req) {
      req = await this.linkRepository.findByDiscordUserId(requestIdOrUserId);
    }
    if (!req) {
      req = await this.linkRepository.findByTrainerId(requestIdOrUserId);
    }
    return req;
  }

  public async approveRequest(requestId: string, reviewerId?: string): Promise<LinkRequestEntity | null> {
    return this.linkRepository.updateStatus(requestId, 'approved', reviewerId);
  }

  public async rejectRequest(requestId: string, reason?: string, reviewerId?: string): Promise<LinkRequestEntity | null> {
    return this.linkRepository.updateStatus(requestId, 'rejected', reviewerId, reason);
  }

  public toKnowledgeResult(req: LinkRequestEntity): DatabaseKnowledgeResult {
    return {
      source: 'database',
      entityType: 'link_request',
      entityId: req.requestId,
      payload: req,
      confidence: 0.95,
      timestamp: new Date(),
      authority: 95,
      metadata: {
        discordUserId: req.discordUserId,
        trainerId: req.trainerId,
        status: req.status
      }
    };
  }
}
