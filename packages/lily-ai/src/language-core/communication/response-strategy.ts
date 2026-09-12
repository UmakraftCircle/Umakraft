export class ResponseStrategyEngine {
  public determine(params: {
    text: string;
    goal?: string;
    emotion?: string;
    clarificationNeeded?: boolean;
  }): string {
    const normalized = params.text.toLowerCase();

    if (params.clarificationNeeded) {
      return 'Clarify';
    }

    if (
      params.goal === 'Learning' ||
      normalized.includes('what is') ||
      normalized.includes('what') ||
      normalized.includes('meaning') ||
      normalized.includes('explain')
    ) {
      return 'Explain';
    }

    if (
      params.goal === 'Race Help' ||
      params.goal === 'Parent Search' ||
      params.goal === 'ParentSearch' ||
      params.goal === 'Coaching' ||
      normalized.includes('lose') ||
      normalized.includes('lost') ||
      normalized.includes('losing') ||
      normalized.includes('how do i improve')
    ) {
      return 'Coach';
    }

    if (
      normalized.includes('finally') ||
      normalized.includes('won') ||
      normalized.includes('victory') ||
      normalized.includes('poggers') ||
      normalized.includes('hit') ||
      normalized.includes('success')
    ) {
      return 'Celebrate';
    }

    if (
      params.goal === 'Link Request' ||
      normalized.includes('link') ||
      normalized.includes('setup')
    ) {
      return 'Guide';
    }

    if (
      normalized.includes('warning') ||
      normalized.includes('alert') ||
      normalized.includes('danger')
    ) {
      return 'Warn';
    }

    if (
      normalized.includes('summary') ||
      normalized.includes('summarize') ||
      normalized.includes('report')
    ) {
      return 'Summarize';
    }

    if (
      params.goal === 'Build Help' ||
      normalized.includes('build')
    ) {
      return 'Coach';
    }

    return 'Answer';
  }
}
