export interface UserProfile {
  trainerId?: string;
  trainerName?: string;
  linkedDiscordId?: string;
  clubId?: string;
  clubName?: string;
  preferences: Record<string, unknown>;
  lastFanCheck?: string | number;
  lastFanGain?: number;
  lastMilestone?: string;
}

export class UserMemory {
  private profiles = new Map<string, UserProfile>();

  public getProfile(userId: string): UserProfile {
    if (!this.profiles.has(userId)) {
      this.profiles.set(userId, { preferences: {} });
    }
    return this.profiles.get(userId)!;
  }

  public updateProfile(userId: string, data: Partial<UserProfile>) {
    const profile = this.getProfile(userId);
    Object.assign(profile, data);
  }
}
