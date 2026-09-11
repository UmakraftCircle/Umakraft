import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('HandbookService');

export class HandbookService {
  private static instance: HandbookService;
  private rules: string[] = [
    'Club Rule 1: Minimum monthly requirement is 150 million fans.',
    'Club Rule 2: Inactivity exceeding 7 days without notice may result in review.',
    'Club Rule 3: Maintain respectful and supportive club communication.',
  ];

  public static getInstance(): HandbookService {
    if (!HandbookService.instance) {
      HandbookService.instance = new HandbookService();
    }
    return HandbookService.instance;
  }

  public search(query: string): string[] {
    const lower = (query || '').toLowerCase();
    return this.rules.filter(r => r.toLowerCase().includes(lower) || lower.includes('rule') || lower.includes('handbook') || lower.includes('requirement'));
  }

  public retrieveAll(): string[] {
    return this.rules;
  }
}

export const handbookService = HandbookService.getInstance();
