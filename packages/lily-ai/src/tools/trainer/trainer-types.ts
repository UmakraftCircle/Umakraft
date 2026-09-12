import { isTursoConfigured, trainerLinkStore } from '@ai-agent-platform/integrations';

export interface TrainerProfileResult {
  trainerId: string;
  trainerName: string;
  linked: boolean;
  clubName?: string;
  clubId?: string;
  linkedDiscordId?: string;
  stats?: {
    totalFans?: number;
    monthlyFans?: number;
    rank?: number | string;
    clubRankTier?: string;
  };
}

export interface TrainerLinkStatusResult {
  linked: boolean;
  trainerId?: string;
  trainerName?: string;
  clubName?: string;
}

export interface ITrainerDataProvider {
  getProfile(trainerIdOrDiscordId: string, discordUserId?: string): Promise<TrainerProfileResult | null> | TrainerProfileResult | null;
  getLinkStatus(discordUserId: string): Promise<TrainerLinkStatusResult> | TrainerLinkStatusResult;
  lookupTrainer(trainerId: string): Promise<TrainerProfileResult | null> | TrainerProfileResult | null;
}

/**
 * Knowledge / Data Source Constraint:
 * Trainer data MUST strictly come from Database (Turso / SQLite or Database provider).
 * NEVER from Handbook, Taxonomy, or Web Search.
 */
export const TRAINER_DATA_SOURCE_RULE = {
  domain: 'trainer_data',
  allowedSource: 'database',
  forbiddenSources: ['handbook', 'lily_handbook', 'taxonomy', 'web_search', 'uma.guide'] as const
};

export class DefaultTrainerDataProvider implements ITrainerDataProvider {
  private profiles = new Map<string, TrainerProfileResult>();
  private linksByDiscordId = new Map<string, string>(); // discordUserId -> trainerId

  constructor() {
    // Seed default baseline profile (RiceEnjoyer / Umakraft)
    this.setProfile({
      trainerId: '123456',
      trainerName: 'RiceEnjoyer',
      linked: true,
      clubName: 'Umakraft',
      clubId: '974470619',
      linkedDiscordId: 'user-rice'
    });
    this.linksByDiscordId.set('user-rice', '123456');

    this.profiles.set('789012', {
      trainerId: '789012',
      trainerName: 'CafeLover',
      linked: true,
      clubName: 'Umakraft',
      clubId: '974470619',
      linkedDiscordId: 'user-cafe'
    });
    this.linksByDiscordId.set('user-cafe', '789012');
  }

  public setProfile(profile: TrainerProfileResult): void {
    this.profiles.set(profile.trainerId, profile);
    if (profile.linkedDiscordId) {
      this.linksByDiscordId.set(profile.linkedDiscordId, profile.trainerId);
    }
  }

  public linkDiscordUser(
    discordUserId: string,
    trainerId: string,
    trainerName?: string,
    clubName: string = 'Umakraft'
  ): void {
    this.linksByDiscordId.set(discordUserId, trainerId);
    const existing = this.profiles.get(trainerId);
    if (existing) {
      existing.linked = true;
      existing.linkedDiscordId = discordUserId;
      if (trainerName) existing.trainerName = trainerName;
      if (clubName) existing.clubName = clubName;
    } else {
      this.profiles.set(trainerId, {
        trainerId,
        trainerName: trainerName || 'Trainer',
        linked: true,
        clubName,
        linkedDiscordId: discordUserId
      });
    }
  }

  public unlinkDiscordUser(discordUserId: string): void {
    const trainerId = this.linksByDiscordId.get(discordUserId);
    if (trainerId) {
      const profile = this.profiles.get(trainerId);
      if (profile && profile.linkedDiscordId === discordUserId) {
        profile.linked = false;
        delete profile.linkedDiscordId;
      }
      this.linksByDiscordId.delete(discordUserId);
    }
  }

  public async getLinkStatus(discordUserId: string): Promise<TrainerLinkStatusResult> {
    // 1. Check in-memory store
    const trainerId = this.linksByDiscordId.get(discordUserId);
    if (trainerId) {
      const profile = this.profiles.get(trainerId);
      return {
        linked: true,
        trainerId,
        trainerName: profile?.trainerName || 'Trainer',
        clubName: profile?.clubName || 'Umakraft'
      };
    }

    // 2. Check trainerLinkStore from database if configured
    try {
      if (isTursoConfigured()) {
        const link = await trainerLinkStore.getByDiscordUser(discordUserId);
        if (link) {
          return {
            linked: true,
            trainerId: link.trainerId,
            trainerName: link.trainerName,
            clubName: 'Umakraft'
          };
        }
      }
    } catch {
      // Database not configured or unavailable
    }

    // 3. Fallback: Not linked
    return {
      linked: false
    };
  }

  public async getProfile(
    trainerIdOrDiscordId: string,
    discordUserId?: string
  ): Promise<TrainerProfileResult | null> {
    // If a discordUserId is supplied, check whether it is linked first
    let resolvedTrainerId = trainerIdOrDiscordId;
    if (discordUserId && this.linksByDiscordId.has(discordUserId)) {
      resolvedTrainerId = this.linksByDiscordId.get(discordUserId)!;
    } else if (this.linksByDiscordId.has(trainerIdOrDiscordId)) {
      resolvedTrainerId = this.linksByDiscordId.get(trainerIdOrDiscordId)!;
    }

    // Check profiles store
    if (this.profiles.has(resolvedTrainerId)) {
      return this.profiles.get(resolvedTrainerId)!;
    }

    // Check trainerLinkStore from database
    try {
      if (isTursoConfigured()) {
        const link = await trainerLinkStore.getByDiscordUser(resolvedTrainerId);
        if (link) {
          const profile: TrainerProfileResult = {
            trainerId: link.trainerId,
            trainerName: link.trainerName,
            linked: true,
            clubName: 'Umakraft',
            linkedDiscordId: link.discordUserId
          };
          this.profiles.set(link.trainerId, profile);
          return profile;
        }
      }
    } catch {
      // Database not configured or query error
    }

    return null;
  }

  public async lookupTrainer(trainerId: string): Promise<TrainerProfileResult | null> {
    return this.getProfile(trainerId);
  }
}

export const defaultTrainerDataProvider = new DefaultTrainerDataProvider();
