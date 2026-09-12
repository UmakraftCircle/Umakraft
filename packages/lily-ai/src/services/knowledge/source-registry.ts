import { KnowledgeSource } from './knowledge-analysis.js';

export const FORBIDDEN_TRAINER_DATA_SOURCES = [KnowledgeSource.HANDBOOK, KnowledgeSource.TAXONOMY, 'web_search', 'uma.guide'] as const;
export { FORBIDDEN_CLUB_DATA_SOURCES } from '../../tools/leaderboard/leaderboard-types.js';
export { FORBIDDEN_LINK_DATA_SOURCES } from '../../tools/link/link-types.js';

export class SourceRegistry {
  public getSourceForDomain(domain: string): KnowledgeSource {
    switch (domain) {
      case 'character':
      case 'character_info':
      case 'skill':
      case 'skill_info':
      case 'support_info':
      case 'track':
      case 'track_info':
      case 'race_info':
      case 'mechanics':
        return KnowledgeSource.UMA_KNOWLEDGE;

      case 'build_advice':
        return KnowledgeSource.UMA_KNOWLEDGE;

      case 'training_advice':
        return KnowledgeSource.UMA_KNOWLEDGE;

      case 'career_plan':
        return KnowledgeSource.UMA_KNOWLEDGE;

      case 'meta_analysis':
        return KnowledgeSource.META;

      case 'learning':
        return KnowledgeSource.MEMORY;

      case 'vision_analysis':
        return KnowledgeSource.META;
        
      case 'club_rules':
      case 'membership':
      case 'fan_requirements':
      case 'activity_rules':
      case 'linking':
      case 'club_procedures':
      case 'faq':
        return KnowledgeSource.HANDBOOK;
        
      case 'trainer_data':
      case 'fan_data':
      case 'club_data':
      case 'account_linking':
        return KnowledgeSource.DATABASE;

      case 'parent_search':
        return KnowledgeSource.PUREDB;
        
      default:
        return KnowledgeSource.NONE;
    }
  }

  /**
   * Enforces knowledge rules
   */
  public isSourceAllowed(domain: string, source: KnowledgeSource): boolean {
    if (domain === 'trainer_data' || domain === 'club_data' || domain === 'account_linking') {
      return source === KnowledgeSource.DATABASE;
    }
    const handbookDomains = ['club_rules', 'membership', 'fan_requirements', 'activity_rules', 'linking', 'club_procedures', 'faq'];
    if (handbookDomains.includes(domain)) {
      return source === KnowledgeSource.HANDBOOK;
    }
    return true;
  }
}
