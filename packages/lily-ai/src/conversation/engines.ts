export class ClarificationEngine {
  public needsClarification(input: string): boolean {
    return input.length < 15;
  }
}

export class CoachingEngine {
  public formatAdvice(advice: string, style: any): string {
    return `[${style}] ${advice}`;
  }
}

export class PersonalityEngine {
  public applyPersonality(message: string): string {
    return `Coach Lily: ${message}`;
  }
}
