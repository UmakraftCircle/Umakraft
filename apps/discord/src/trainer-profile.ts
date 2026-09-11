import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('TrainerProfileEngine');

export type InteractionStyle = 'COMPETITIVE' | 'COLLECTOR' | 'CASUAL' | 'ANALYST';

export type ResponseLengthPreference = 'short' | 'detailed';

export type RelationshipLevel = 'NEW' | 'REGULAR' | 'ACTIVE' | 'VETERAN';

export interface TrainerProfile {
  trainerId: string;
  interactionStyle: InteractionStyle;
  favoriteTopics: string[];
  favoriteCharacters: string[];
  preferredResponseLength: ResponseLengthPreference;
  relationshipLevel: RelationshipLevel;
  interactionCount: number;
  lastInteractionTimestamp: number;
}

export class TrainerProfileEngine {
  private static instance: TrainerProfileEngine;
  private profiles: Map<string, TrainerProfile> = new Map();

  public static getInstance(): TrainerProfileEngine {
    if (!TrainerProfileEngine.instance) {
      TrainerProfileEngine.instance = new TrainerProfileEngine();
    }
    return TrainerProfileEngine.instance;
  }

  /**
  * Retrieves or initializes a trainer profile.
  */
  public getOrCreateProfile(trainerId: string): TrainerProfile {
    let profile = this.profiles.get(trainerId);
    if (!profile) {
      profile = {
        trainerId,
        interactionStyle: 'CASUAL',
        favoriteTopics: [],
        favoriteCharacters: [],
        preferredResponseLength: 'short',
        relationshipLevel: 'NEW',
        interactionCount: 0,
        lastInteractionTimestamp: Date.now(),
      };
      this.profiles.set(trainerId, profile);
      logger.info(`[Trainer Profile Created] ID: ${trainerId}`);
    }
    return profile;
  }

  /**
  * Analyzes recent interaction message and updates the trainer's profile archetype and preferences.
  */
  public recordInteraction(trainerId: string, message: string): TrainerProfile {
    const profile = this.getOrCreateProfile(trainerId);
    profile.interactionCount++;
    profile.lastInteractionTimestamp = Date.now();

    // Update relationship level based on interaction count
    if (profile.interactionCount > 50) {
      profile.relationshipLevel = 'VETERAN';
    } else if (profile.interactionCount > 20) {
      profile.relationshipLevel = 'ACTIVE';
    } else if (profile.interactionCount > 5) {
      profile.relationshipLevel = 'REGULAR';
    } else {
      profile.relationshipLevel = 'NEW';
    }

    const lower = (message || '').toLowerCase();

    // Archetype Classification Heuristics
    if (/\b(leaderboard|rank|gap|top\s+players?|ranking|behind)\b/i.test(lower)) {
      profile.interactionStyle = 'COMPETITIVE';
      if (!profile.favoriteTopics.includes('leaderboards')) profile.favoriteTopics.push('leaderboards');
    } else if (/\b(lore|character|support\s+cards?|smart\s+falcon|tokai\s+teio|oguri\s+cap)\b/i.test(lower)) {
      profile.interactionStyle = 'COLLECTOR';
      if (!profile.favoriteTopics.includes('lore')) profile.favoriteTopics.push('lore');
      
      // Track favorite characters
      const knownChars = ['smart falcon', 'tokai teio', 'oguri cap', 'silence suzuka', 'gold ship'];
      for (const char of knownChars) {
        if (lower.includes(char)) {
          const formatted = char.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (!profile.favoriteCharacters.includes(formatted)) {
            profile.favoriteCharacters.push(formatted);
          }
        }
      }
    } else if (/\b(calculate|pace|projection|optimization|formula|math|stats?)\b/i.test(lower)) {
      profile.interactionStyle = 'ANALYST';
      if (!profile.favoriteTopics.includes('analytics')) profile.favoriteTopics.push('analytics');
      profile.preferredResponseLength = 'detailed';
    } else if (/\b(hello|hi|help|guide|thanks)\b/i.test(lower)) {
      if (profile.interactionStyle === 'CASUAL') {
        profile.interactionStyle = 'CASUAL';
      }
    }

    this.profiles.set(trainerId, profile);
    return profile;
  }

  /**
  * Personalizes a response message based on the trainer's detected interaction style and preferences.
  */
  public personalizeResponse(trainerId: string, baseMessage: string, contextType: 'rank' | 'pace' | 'general'): string {
    const profile = this.getOrCreateProfile(trainerId);

    if (profile.interactionStyle === 'COMPETITIVE') {
      if (contextType === 'rank') {
        return `Trainer, lock in! You're closing the gap fast—only 800K fans behind the next rank.`;
      }
      return `Trainer, the top positions are within reach. Keep pushing! (${baseMessage})`;
    }

    if (profile.interactionStyle === 'ANALYST') {
      if (contextType === 'pace') {
        return `Trainer, analytical projection: Your current average gain exceeds the required pacing target by 12.4%. (${baseMessage})`;
      }
      return `Trainer, performance metrics updated: ${baseMessage}`;
    }

    if (profile.interactionStyle === 'COLLECTOR' && profile.favoriteCharacters.length > 0) {
      const fav = profile.favoriteCharacters[0];
      return `Trainer, speaking of ${fav} and your favorite handbook lore: ${baseMessage}`;
    }

    // Default / Casual response
    if (contextType === 'rank') {
      return `Trainer, you're currently ranked well. Nice work! (${baseMessage})`;
    }
    return `Trainer, you're making steady progress. Keep it up! (${baseMessage})`;
  }

  public clearAll(): void {
    this.profiles.clear();
  }
}

export const trainerProfileEngine = TrainerProfileEngine.getInstance();
