import { LinkRequestEntity } from './repository-types.js';

export interface ILinkRepository {
  createRequest(discordUserId: string, trainerId: string, trainerName: string): Promise<LinkRequestEntity>;
  findById(requestId: string): Promise<LinkRequestEntity | null>;
  findByDiscordUserId(discordUserId: string): Promise<LinkRequestEntity | null>;
  findByTrainerId(trainerId: string): Promise<LinkRequestEntity | null>;
  findPending(limit?: number): Promise<LinkRequestEntity[]>;
  updateStatus(requestId: string, status: 'approved' | 'rejected', reviewerId?: string, reason?: string): Promise<LinkRequestEntity | null>;
}

export class DefaultLinkRepository implements ILinkRepository {
  private requests = new Map<string, LinkRequestEntity>();
  private nextId = 1;

  constructor() {
    this.seedDefaultRequests();
  }

  private seedDefaultRequests(): void {
    const defaultReq: LinkRequestEntity = {
      requestId: 'req_101',
      discordUserId: 'user_applicant_1',
      trainerId: '987654',
      trainerName: 'NewChallenger',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600_000 * 2) // 2 hours ago
    };
    this.requests.set(defaultReq.requestId, defaultReq);
  }

  public async createRequest(
    discordUserId: string,
    trainerId: string,
    trainerName: string
  ): Promise<LinkRequestEntity> {
    // Check if pending already exists
    const existing = await this.findByDiscordUserId(discordUserId);
    if (existing && existing.status === 'pending') {
      return existing;
    }

    const requestId = `req_${Date.now()}_${this.nextId++}`;
    const entity: LinkRequestEntity = {
      requestId,
      discordUserId,
      trainerId,
      trainerName,
      status: 'pending',
      createdAt: new Date()
    };

    this.requests.set(requestId, entity);
    return entity;
  }

  public async findById(requestId: string): Promise<LinkRequestEntity | null> {
    return this.requests.get(requestId) || null;
  }

  public async findByDiscordUserId(discordUserId: string): Promise<LinkRequestEntity | null> {
    for (const req of this.requests.values()) {
      if (req.discordUserId === discordUserId) {
        return req;
      }
    }
    return null;
  }

  public async findByTrainerId(trainerId: string): Promise<LinkRequestEntity | null> {
    for (const req of this.requests.values()) {
      if (req.trainerId === trainerId) {
        return req;
      }
    }
    return null;
  }

  public async findPending(limit: number = 50): Promise<LinkRequestEntity[]> {
    const list: LinkRequestEntity[] = [];
    for (const req of this.requests.values()) {
      if (req.status === 'pending') {
        list.push(req);
        if (list.length >= limit) break;
      }
    }
    return list;
  }

  public async updateStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    reviewerId?: string,
    reason?: string
  ): Promise<LinkRequestEntity | null> {
    const req = this.requests.get(requestId);
    if (!req) return null;

    req.status = status;
    req.reviewedAt = new Date();
    req.reviewerId = reviewerId;
    if (reason) req.rejectionReason = reason;

    return req;
  }
}
