export interface FederationQuery {
  text: string;
  userId?: string;
  trainerId?: string;
  guildId?: string;
  context?: string | Record<string, unknown> | FederationContext;
  filters?: Record<string, unknown>;
  maxResults?: number;
  minConfidence?: number;
}

export interface FederationContext {
  userId?: string;
  trainerId?: string;
  trainerName?: string;
  guildId?: string;
  runningStyle?: string;
  character?: string;
  currentEvent?: string;
  track?: string;
  surface?: string;
  distance?: string;
  intent?: string;
  userGoal?: string;
  domain?: string;
  entities: string[];
  semanticExpansions: string[];
  metadata: Record<string, unknown>;
}

export class FederationContextBuilder {
  private static RUNNING_STYLES = [
    'Front Runner',
    'Pace Chaser',
    'Late Surger',
    'End Closer',
    'Nige',
    'Senkou',
    'Sashi',
    'Oikomi'
  ];

  private static KNOWN_CHARACTERS = [
    'Rice Shower',
    'Mejiro McQueen',
    'Tokai Teio',
    'Special Week',
    'Silence Suzuka',
    'Oguri Cap',
    'Gold Ship',
    'Vodka',
    'Daiwa Scarlet',
    'Symboli Rudolf',
    'Grass Wonder',
    'El Condor Pasa',
    'Taiki Shuttle',
    'Super Creek',
    'Tamamo Cross',
    'Narita Brian',
    'Mayano Top Gun',
    'Manhattan Cafe',
    'Agnes Tachyon',
    'Winning Ticket',
    'King Halo'
  ];

  private static DISTANCES = ['Short', 'Mile', 'Medium', 'Long', 'Sprint'];
  private static SURFACES = ['Turf', 'Dirt'];

  public static build(query: FederationQuery, existingContext?: Partial<FederationContext>): FederationContext {
    const rawText = query.text || '';
    const lowerText = rawText.toLowerCase();

    // 1. Detect running style
    let detectedStyle = existingContext?.runningStyle;
    if (!detectedStyle) {
      for (const style of this.RUNNING_STYLES) {
        if (lowerText.includes(style.toLowerCase())) {
          if (style.toLowerCase() === 'nige') detectedStyle = 'Front Runner';
          else if (style.toLowerCase() === 'senkou') detectedStyle = 'Pace Chaser';
          else if (style.toLowerCase() === 'sashi') detectedStyle = 'Late Surger';
          else if (style.toLowerCase() === 'oikomi') detectedStyle = 'End Closer';
          else detectedStyle = style;
          break;
        }
      }
    }

    // 2. Detect character
    let detectedChar = existingContext?.character;
    if (!detectedChar) {
      for (const char of this.KNOWN_CHARACTERS) {
        if (lowerText.includes(char.toLowerCase())) {
          detectedChar = char;
          break;
        }
      }
    }

    // 3. Detect distance & surface
    let detectedDistance = existingContext?.distance;
    if (!detectedDistance) {
      for (const dist of this.DISTANCES) {
        if (lowerText.includes(dist.toLowerCase())) {
          detectedDistance = dist;
          break;
        }
      }
    }

    let detectedSurface = existingContext?.surface;
    if (!detectedSurface) {
      for (const surf of this.SURFACES) {
        if (lowerText.includes(surf.toLowerCase())) {
          detectedSurface = surf;
          break;
        }
      }
    }

    // 4. Detect Intent
    let detectedIntent = existingContext?.intent;
    if (!detectedIntent) {
      if (lowerText.includes('build') || lowerText.includes('guide') || lowerText.includes('deck') || lowerText.includes('strategy')) {
        detectedIntent = 'build_guide';
      } else if (lowerText.includes('rank') || lowerText.includes('leaderboard') || lowerText.includes('standings') || lowerText.includes('who is leading')) {
        detectedIntent = 'leaderboard';
      } else if (lowerText.includes('fan') || lowerText.includes('how am i doing') || lowerText.includes('progress') || lowerText.includes('gain')) {
        detectedIntent = 'fan_progress';
      } else if (lowerText.includes('milestone') || lowerText.includes('eligible') || lowerText.includes('requirement')) {
        detectedIntent = 'milestone_check';
      } else if (lowerText.includes('what is') || lowerText.includes('define') || lowerText.includes('meaning')) {
        detectedIntent = 'definition';
      }
    }

    // 5. Extract entities
    const extractedEntities: string[] = [...(existingContext?.entities || [])];
    if (detectedStyle && !extractedEntities.includes(detectedStyle)) extractedEntities.push(detectedStyle);
    if (detectedChar && !extractedEntities.includes(detectedChar)) extractedEntities.push(detectedChar);
    if (detectedDistance && !extractedEntities.includes(detectedDistance)) extractedEntities.push(detectedDistance);
    if (detectedSurface && !extractedEntities.includes(detectedSurface)) extractedEntities.push(detectedSurface);

    // Merge metadata
    const metadata: Record<string, unknown> = {
      ...(typeof query.context === 'object' && query.context !== null ? query.context : {}),
      ...(existingContext?.metadata || {})
    };

    return {
      userId: query.userId || existingContext?.userId,
      trainerId: query.trainerId || (metadata.trainerId as string) || existingContext?.trainerId || query.userId,
      trainerName: (metadata.trainerName as string) || existingContext?.trainerName,
      guildId: query.guildId || existingContext?.guildId,
      runningStyle: detectedStyle,
      character: detectedChar,
      currentEvent: (metadata.currentEvent as string) || existingContext?.currentEvent,
      track: (metadata.track as string) || existingContext?.track,
      surface: detectedSurface,
      distance: detectedDistance,
      intent: detectedIntent,
      userGoal: (metadata.userGoal as string) || existingContext?.userGoal,
      domain: (metadata.domain as string) || existingContext?.domain || 'Umamusume',
      entities: extractedEntities,
      semanticExpansions: existingContext?.semanticExpansions || [],
      metadata
    };
  }
}
