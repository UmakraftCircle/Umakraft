export interface DirectClarification {
  type: 'direct';
  question: string;
  options: string[];
}

export class DirectClarificationEngine {
  public resolve(text: string): DirectClarification | null {
    const normalized = text.toLowerCase().trim();

    if (normalized.includes('speed parent')) {
      return {
        type: 'direct',
        question: 'When you say "speed parent", which do you mean?',
        options: [
          'Speed Factor Parent',
          'Speed-focused Parent Build',
          'Speed Skill Inheritance'
        ]
      };
    }

    if (normalized.includes('speed thing')) {
      return {
        type: 'direct',
        question: 'When you say "speed thing", which do you mean?',
        options: [
          'Speed Stat',
          'Speed Card',
          'Speed Factor'
        ]
      };
    }

    return null;
  }
}
