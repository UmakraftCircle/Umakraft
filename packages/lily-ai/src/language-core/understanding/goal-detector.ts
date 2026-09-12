export class GoalDetector {
  /**
   * Detects the user's high-level goal from text input
   */
  public detect(text: string): string {
    const normalized = text.toLowerCase();

    // Check Race Help (highest priority because struggling or losing is a critical path)
    if (normalized.includes('lose') || normalized.includes('losing') || normalized.includes('lost') || normalized.includes('race') || normalized.includes('match') || normalized.includes('win')) {
      return 'Race Help';
    }

    // Check Parent Search
    if (normalized.includes('parent') || normalized.includes('breeding') || normalized.includes('factor')) {
      return 'Parent Search';
    }

    // Check Build Help
    if (normalized.includes('build') || normalized.includes('setup') || normalized.includes('optimize') || normalized.includes('training') || normalized.includes('improve')) {
      return 'Build Help';
    }

    // Check Club Help / Link Request
    if (normalized.includes('club') || normalized.includes('link') || normalized.includes('unlink') || normalized.includes('approval')) {
      if (normalized.includes('link')) {
        return 'Link Request';
      }
      return 'Club Help';
    }

    // Check Leaderboard
    if (normalized.includes('leaderboard') || normalized.includes('score') || normalized.includes('rank') || normalized.includes('top')) {
      return 'Leaderboard';
    }

    // Check Fan Tracking
    if (normalized.includes('fans') || normalized.includes('fan counter') || normalized.includes('million fans')) {
      return 'Fan Tracking';
    }

    // Check Coaching
    if (normalized.includes('coach') || normalized.includes('tips') || normalized.includes('guide') || normalized.includes('advice')) {
      return 'Coaching';
    }

    // Check Learning
    if (normalized.includes('explain') || normalized.includes('definition') || normalized.includes('meaning') || normalized.includes('what is')) {
      return 'Learning';
    }

    // Check Information
    if (normalized.includes('info') || normalized.includes('stat') || normalized.includes('details') || normalized.includes('about')) {
      return 'Information';
    }

    // Check General Conversation
    if (normalized.includes('hello') || normalized.includes('hi') || normalized.includes('hey') || normalized.includes('how are you') || normalized.includes('thanks') || normalized.includes('thank you')) {
      return 'General Conversation';
    }

    return 'Information'; // fallback default
  }
}
