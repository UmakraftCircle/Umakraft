import { TrainerEntity } from './repository-types.js';
import { defaultTrainerDataProvider, ITrainerDataProvider } from '../../../tools/trainer/trainer-types.js';

export interface ITrainerRepository {
  findById(trainerId: string): Promise<TrainerEntity | null>;
  findByDiscordId(discordUserId: string): Promise<TrainerEntity | null>;
  findByName(name: string): Promise<TrainerEntity | null>;
  findAll(limit?: number, offset?: number): Promise<TrainerEntity[]>;
  save(trainer: TrainerEntity): Promise<void>;
}

export class DefaultTrainerRepository implements ITrainerRepository {
  private customTrainers = new Map<string, TrainerEntity>();
  private provider: ITrainerDataProvider;

  constructor(provider?: ITrainerDataProvider) {
    this.provider = provider || defaultTrainerDataProvider;
    this.seedDefaultTrainers();
  }

  private seedDefaultTrainers(): void {
    const defaultData: TrainerEntity[] = [
      {
        trainerId: '123456',
        trainerName: 'RiceEnjoyer',
        linked: true,
        clubName: 'Umakraft',
        clubId: '974470619',
        linkedDiscordId: 'user-rice',
        status: 'active',
        joinedAt: new Date('2024-01-01')
      },
      {
        trainerId: '789012',
        trainerName: 'CafeLover',
        linked: true,
        clubName: 'Umakraft',
        clubId: '974470619',
        linkedDiscordId: 'user-cafe',
        status: 'active',
        joinedAt: new Date('2024-02-15')
      },
      {
        trainerId: '234567',
        trainerName: 'SuzukaMain',
        linked: false,
        clubName: 'Umakraft',
        clubId: '974470619',
        status: 'active'
      },
      {
        trainerId: '345678',
        trainerName: 'TeioFan',
        linked: false,
        clubName: 'Umakraft',
        clubId: '974470619',
        status: 'active'
      },
      {
        trainerId: '456789',
        trainerName: 'OguriEnjoyer',
        linked: false,
        clubName: 'Umakraft',
        clubId: '974470619',
        status: 'active'
      }
    ];

    for (const t of defaultData) {
      this.customTrainers.set(t.trainerId, t);
    }
  }

  public async findById(trainerId: string): Promise<TrainerEntity | null> {
    if (this.customTrainers.has(trainerId)) {
      return this.customTrainers.get(trainerId)!;
    }

    const profile = await this.provider.getProfile(trainerId);
    if (profile) {
      return {
        trainerId: profile.trainerId,
        trainerName: profile.trainerName,
        linked: profile.linked,
        clubName: profile.clubName || 'Umakraft',
        clubId: profile.clubId || '974470619',
        linkedDiscordId: profile.linkedDiscordId,
        status: 'active'
      };
    }

    return null;
  }

  public async findByDiscordId(discordUserId: string): Promise<TrainerEntity | null> {
    for (const trainer of this.customTrainers.values()) {
      if (trainer.linkedDiscordId === discordUserId) {
        return trainer;
      }
    }

    const profile = await this.provider.getProfile(discordUserId, discordUserId);
    if (profile) {
      return {
        trainerId: profile.trainerId,
        trainerName: profile.trainerName,
        linked: profile.linked,
        clubName: profile.clubName || 'Umakraft',
        clubId: profile.clubId || '974470619',
        linkedDiscordId: profile.linkedDiscordId || discordUserId,
        status: 'active'
      };
    }

    return null;
  }

  public async findByName(name: string): Promise<TrainerEntity | null> {
    const lower = name.trim().toLowerCase();
    for (const trainer of this.customTrainers.values()) {
      if (trainer.trainerName.toLowerCase() === lower || trainer.trainerName.toLowerCase().includes(lower)) {
        return trainer;
      }
    }
    return null;
  }

  public async findAll(limit: number = 50, offset: number = 0): Promise<TrainerEntity[]> {
    const list = Array.from(this.customTrainers.values());
    return list.slice(offset, offset + limit);
  }

  public async save(trainer: TrainerEntity): Promise<void> {
    this.customTrainers.set(trainer.trainerId, trainer);
  }
}
