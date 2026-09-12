import { IClubRepository } from '../repositories/club-repository.js';
import { ClubEntity } from '../repositories/repository-types.js';
import { DatabaseKnowledgeResult } from '../database-result.js';

export class ClubKnowledgeModule {
  private clubRepository: IClubRepository;

  constructor(clubRepository: IClubRepository) {
    this.clubRepository = clubRepository;
  }

  public async getClubData(clubIdOrName?: string): Promise<ClubEntity> {
    if (!clubIdOrName || clubIdOrName.toLowerCase() === 'umakraft' || clubIdOrName === '974470619') {
      return this.clubRepository.getDefaultClub();
    }
    const byId = await this.clubRepository.getClubById(clubIdOrName);
    if (byId) return byId;

    const byName = await this.clubRepository.getClubByName(clubIdOrName);
    if (byName) return byName;

    return this.clubRepository.getDefaultClub();
  }

  public toKnowledgeResult(club: ClubEntity): DatabaseKnowledgeResult {
    return {
      source: 'database',
      entityType: 'club',
      entityId: club.clubId,
      payload: club,
      confidence: 0.99,
      timestamp: new Date(),
      authority: 95,
      metadata: {
        clubName: club.clubName,
        memberCount: club.memberCount,
        totalFans: club.totalFans,
        status: club.status
      }
    };
  }
}
