export class CommunicationStyleEngine {
  public select(params: { text: string; goal?: string }): string {
    const normalized = params.text.toLowerCase().trim();
    const words = normalized.split(/\s+/).filter(w => w.length > 0);

    if (words.length <= 2 && !normalized.includes('what')) {
      return 'Short';
    }

    if (
      normalized.includes('factor') ||
      normalized.includes('inheritance') ||
      normalized.includes('optimization') ||
      normalized.includes('formula')
    ) {
      return 'Expert';
    }

    if (
      params.goal === 'Learning' ||
      normalized.includes('what is') ||
      normalized.includes('beginner') ||
      normalized.includes('explain') ||
      normalized.includes('what')
    ) {
      return 'Beginner';
    }

    if (
      words.length > 10 ||
      normalized.includes('detailed') ||
      normalized.includes('everything') ||
      normalized.includes('full')
    ) {
      return 'Detailed';
    }

    return 'Standard';
  }
}
