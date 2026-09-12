export interface AudienceProfile {
  audienceType: string;
  confidence: number;
  indicators?: string[];
}

export class AudienceDetector {
  public detect(text: string): AudienceProfile {
    const normalized = text.toLowerCase();

    if (
      normalized.includes('coach') ||
      normalized.includes('trainer') ||
      normalized.includes('my uma') ||
      normalized.includes('training')
    ) {
      return {
        audienceType: 'Trainer',
        confidence: 0.95,
        indicators: ['coach', 'trainer']
      };
    }

    if (
      normalized.includes('officer') ||
      normalized.includes('review this link') ||
      normalized.includes('staff')
    ) {
      return {
        audienceType: 'Officer',
        confidence: 0.95,
        indicators: ['officer']
      };
    }

    if (
      normalized.includes('leader') ||
      normalized.includes('guild leader') ||
      normalized.includes('circle leader')
    ) {
      return {
        audienceType: 'Leader',
        confidence: 0.92,
        indicators: ['leader']
      };
    }

    if (
      normalized.includes('new member') ||
      normalized.includes('just joined') ||
      normalized.includes('beginner') ||
      normalized.includes('newbie')
    ) {
      return {
        audienceType: 'New Member',
        confidence: 0.90,
        indicators: ['new member']
      };
    }

    return {
      audienceType: 'Trainer',
      confidence: 0.85,
      indicators: ['default']
    };
  }
}
