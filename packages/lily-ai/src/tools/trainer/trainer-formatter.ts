import { TrainerProfileResult, TrainerLinkStatusResult } from './trainer-types.js';

export class TrainerFormatter {
  /**
   * Formats a trainer profile into the exact requested LilyAI chat format:
   *
   * Trainer Profile
   *
   * Name: RiceEnjoyer
   * Trainer ID: 123456
   *
   * Status: Linked
   * Club: Umakraft
   */
  public static formatProfile(profile: TrainerProfileResult): string {
    if ((profile as any).unlinkedNotice || (!profile.linked && (!profile.trainerId || profile.trainerId === 'Unknown'))) {
      return `Trainer, I couldn't find a linked trainer profile.\n\nYou can start a link request anytime.`;
    }
    const status = profile.linked ? 'Linked' : 'Unlinked';
    const club = profile.clubName || 'None';
    return `Trainer Profile\n\nName: ${profile.trainerName}\nTrainer ID: ${profile.trainerId}\n\nStatus: ${status}\nClub: ${club}`;
  }

  /**
   * Formats link status:
   *
   * If linked:
   * Trainer, your account is currently linked.
   *
   * Trainer ID: 123456
   *
   * If not linked:
   * Trainer, I couldn't find a linked trainer profile.
   *
   * You can start a link request anytime.
   */
  public static formatLinkStatus(status: TrainerLinkStatusResult): string {
    if (status.linked && status.trainerId) {
      return `Trainer, your account is currently linked.\n\nTrainer ID: ${status.trainerId}`;
    }
    return `Trainer, I couldn't find a linked trainer profile.\n\nYou can start a link request anytime.`;
  }

  /**
   * Formats trainer lookup:
   * If found -> Profile format
   * If not found -> "Trainer, I couldn't find trainer {id} in the database."
   */
  public static formatLookup(profile: TrainerProfileResult | null, searchedId?: string): string {
    if (profile && !(profile as any).notFound && profile.trainerName !== 'Unknown') {
      return TrainerFormatter.formatProfile(profile);
    }
    return `Trainer, I couldn't find trainer ${searchedId || (profile as any)?.trainerId || 'specified'} in the database.`;
  }
}
