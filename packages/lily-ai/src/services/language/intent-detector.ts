import { IntentType, TaxonomyMatch, ExtractedEntity } from './language-analysis.js';

export class IntentDetector {
  public detect(
    normalizedMessage: string, 
    taxonomyMatches: TaxonomyMatch[], 
    entities: ExtractedEntity[]
  ): { intent: IntentType; confidence: number } {
    const hasTrainerId = entities.some(e => e.type === 'trainer_id');
    
    // Factors (blue, distance, style) heavily imply parent search
    const hasFactorMatches = taxonomyMatches.some(t => t.type !== 'character');
    
    const hasMemberRankKeywords = normalizedMessage.includes('what rank am i') ||
                                  normalizedMessage.includes("what's my rank") ||
                                  normalizedMessage.includes('what is my rank') ||
                                  normalizedMessage.includes('my rank') ||
                                  normalizedMessage.includes('where do i rank') ||
                                  normalizedMessage.includes('my standing') ||
                                  normalizedMessage.includes('my position') ||
                                  normalizedMessage.includes('check my rank') ||
                                  normalizedMessage.includes('show my rank');

    const hasTopMembersKeywords = normalizedMessage.includes('who are the top') ||
                                  normalizedMessage.includes('who is at the top') ||
                                  normalizedMessage.includes('who is top') ||
                                  normalizedMessage.includes('top 10') ||
                                  normalizedMessage.includes('top 5') ||
                                  normalizedMessage.includes('top 3') ||
                                  normalizedMessage.includes('top 20') ||
                                  normalizedMessage.includes('top members') ||
                                  normalizedMessage.includes('top trainers');

    const hasLeaderboardKeywords = normalizedMessage.includes('leaderboard') ||
                                   normalizedMessage.includes('club ranking') ||
                                   normalizedMessage.includes('club rankings') ||
                                   normalizedMessage.includes('show rankings') ||
                                   normalizedMessage.includes('who is winning') ||
                                   normalizedMessage.includes('member ranking') ||
                                   normalizedMessage.includes('fan ranking') ||
                                   normalizedMessage.includes('monthly ranking') ||
                                   normalizedMessage.includes('club standings');

    const hasClubStatsKeywords = normalizedMessage.includes('how is the club doing') ||
                                 normalizedMessage.includes('how is our club doing') ||
                                 normalizedMessage.includes('how is umakraft doing') ||
                                 normalizedMessage.includes('club stats') ||
                                 normalizedMessage.includes('club statistics') ||
                                 normalizedMessage.includes('club overview') ||
                                 normalizedMessage.includes('club progress') ||
                                 normalizedMessage.includes('total club fans') ||
                                 normalizedMessage.includes('average club fans');

    const hasParentKeywords = normalizedMessage.includes('parent') || 
                              normalizedMessage.includes('search') ||
                              hasFactorMatches;
                              
    const hasDeficitKeywords = normalizedMessage.includes('deficit') || 
                                normalizedMessage.includes('behind') || 
                                normalizedMessage.includes('falling behind') ||
                                normalizedMessage.includes('behind pace');

    const hasSurplusKeywords = normalizedMessage.includes('surplus') || 
                               normalizedMessage.includes('ahead') || 
                               normalizedMessage.includes('ahead of pace') ||
                               normalizedMessage.includes('excess fans');

    const hasProjectionKeywords = normalizedMessage.includes('projection') || 
                                  normalizedMessage.includes('projected') || 
                                  normalizedMessage.includes('reach 150m') || 
                                  normalizedMessage.includes('reach 200m') || 
                                  normalizedMessage.includes('reach 300m') ||
                                  normalizedMessage.includes('will i reach') ||
                                  normalizedMessage.includes('will i hit') ||
                                  normalizedMessage.includes('on pace for');

    const hasMilestoneKeywords = normalizedMessage.includes('milestone') || 
                                 normalizedMessage.includes('milestones') ||
                                 normalizedMessage.includes('target reached');

    const hasFanGainKeywords = normalizedMessage.includes('gain') || 
                               normalizedMessage.includes('how much fan') ||
                               normalizedMessage.includes('how many fan') ||
                               normalizedMessage.includes('fans today') ||
                               normalizedMessage.includes('gained today') ||
                               normalizedMessage.includes('my fan');

    const hasFanKeywords = normalizedMessage.includes('fan') || 
                           normalizedMessage.includes('gain') || 
                           normalizedMessage.includes('how much');

    const hasLinkKeywords = normalizedMessage.includes('link') ||
                            normalizedMessage.includes('connect');

    const hasLinkRequestKeywords = (hasLinkKeywords && (normalizedMessage.includes('my account') || (normalizedMessage.includes('my') && normalizedMessage.includes('account')) || normalizedMessage.includes('me'))) ||
                                    normalizedMessage.includes('i want to link') ||
                                    normalizedMessage.includes('connect my trainer');

    const hasLinkStatusKeywords = normalizedMessage.includes('is my link approved') ||
                                  normalizedMessage.includes('request status') ||
                                  normalizedMessage.includes('link request status') ||
                                  normalizedMessage.includes('am i linked') ||
                                  normalizedMessage.includes('is my account linked') ||
                                  normalizedMessage.includes('link status') ||
                                  normalizedMessage.includes('is my trainer linked');

    const hasLinkHelpKeywords = (hasLinkKeywords && normalizedMessage.includes('help')) ||
                                 normalizedMessage.includes('how to link') ||
                                 normalizedMessage.includes('how do i link');

    const hasLookupKeywords = normalizedMessage.startsWith('show trainer') ||
                              normalizedMessage.startsWith('lookup trainer') ||
                              normalizedMessage.startsWith('find trainer') ||
                              normalizedMessage.startsWith('search trainer') ||
                              normalizedMessage.startsWith('who is trainer') ||
                              (hasTrainerId && !normalizedMessage.includes('my profile') && !normalizedMessage.includes('my trainer') && (normalizedMessage.startsWith('trainer ') || normalizedMessage.includes('lookup') || normalizedMessage.includes('find')));

    const hasProfileKeywords = normalizedMessage.includes('profile') ||
                               normalizedMessage.includes('my trainer id') ||
                               normalizedMessage.includes('trainer id is') ||
                               normalizedMessage.includes('my id is') ||
                               normalizedMessage === 'who am i' ||
                               normalizedMessage === 'my info' ||
                               normalizedMessage === 'my account';

    const hasTrainerKeywords = normalizedMessage.includes('trainer') || 
                               hasTrainerId;

    const hasFanRequirementsKeywords = normalizedMessage.includes('fan') && (normalizedMessage.includes('minimum') || normalizedMessage.includes('requirement') || normalizedMessage.includes('target') || normalizedMessage.includes('150m'));
    const hasActivityRulesKeywords = normalizedMessage.includes('inactive') || normalizedMessage.includes('kick') || normalizedMessage.includes('activity');
    const hasLinkingKeywords = normalizedMessage.includes('how') && (normalizedMessage.includes('link') || normalizedMessage.includes('connect'));
    const hasMembershipKeywords = normalizedMessage.includes('join') || normalizedMessage.includes('membership') || normalizedMessage.includes('apply');
    const hasProceduresKeywords = normalizedMessage.includes('procedure') || (normalizedMessage.includes('how') && normalizedMessage.includes('review')) || normalizedMessage.includes('process');
    const hasFAQKeywords = normalizedMessage.includes('faq') || (normalizedMessage.includes('how') && normalizedMessage.includes('track'));

    const hasKnowledgeKeywords = normalizedMessage.includes('how does') || 
                                 normalizedMessage.includes('what is') ||
                                 normalizedMessage.includes('explain') ||
                                 normalizedMessage.includes('mechanic') ||
                                 normalizedMessage.includes('rule');

    if (hasProceduresKeywords) {
      return { intent: 'club_procedures', confidence: 0.95 };
    }

    if (hasFAQKeywords) {
      return { intent: 'faq', confidence: 0.95 };
    }

    if (hasFanRequirementsKeywords) {
      return { intent: 'fan_requirements', confidence: 0.98 };
    }

    if (hasActivityRulesKeywords) {
      return { intent: 'activity_rules', confidence: 0.98 };
    }

    if (hasLinkingKeywords) {
      return { intent: 'linking', confidence: 0.95 };
    }

    if (hasMembershipKeywords) {
      return { intent: 'membership', confidence: 0.95 };
    }

    if (hasMemberRankKeywords) {
      return { intent: 'member_rank', confidence: 0.95 };
    }

    if (hasTopMembersKeywords) {
      return { intent: 'top_members', confidence: 0.95 };
    }

    if (hasLeaderboardKeywords) {
      return { intent: 'leaderboard', confidence: 0.95 };
    }

    if (hasClubStatsKeywords) {
      return { intent: 'club_stats', confidence: 0.95 };
    }

    if (hasDeficitKeywords) {
      return { intent: 'fan_deficit', confidence: 0.95 };
    }

    if (hasSurplusKeywords) {
      return { intent: 'fan_surplus', confidence: 0.95 };
    }

    if (hasProjectionKeywords) {
      return { intent: 'fan_projection', confidence: 0.95 };
    }

    if (hasMilestoneKeywords) {
      return { intent: 'fan_milestone', confidence: 0.95 };
    }

    if (hasFanGainKeywords) {
      return { intent: 'fan_gain', confidence: 0.95 };
    }

    if (hasLinkStatusKeywords) {
      const result = { intent: 'link_status' as const, confidence: 0.95 };
      if (normalizedMessage.includes('link status')) {
        // console.log('DEBUG: Matched link_status for:', normalizedMessage);
      }
      return result;
    }

    if (hasLinkRequestKeywords) {
      return { intent: 'link_request', confidence: 0.95 };
    }

    if (hasLinkHelpKeywords) {
      return { intent: 'link_help', confidence: 0.95 };
    }

    if (hasLookupKeywords) {
      return { intent: 'trainer_lookup', confidence: 0.95 };
    }

    if (hasProfileKeywords) {
      return { intent: 'trainer_profile', confidence: 0.95 };
    }

    if (hasTrainerKeywords && !hasParentKeywords) {
      return { intent: 'trainer_search', confidence: 0.90 };
    }

    if (hasFanKeywords) {
      return { intent: 'fan_gain', confidence: 0.90 };
    }

    if (hasKnowledgeKeywords) {
      return { intent: 'knowledge_query', confidence: 0.90 };
    }

    if (hasParentKeywords) {
      return { intent: 'parent_search', confidence: 0.95 };
    }

    // Fallback if we only matched a character but no specific intent
    if (taxonomyMatches.some(t => t.type === 'character')) {
       // Could be general chat or implicit parent search, but we default to parent search
       return { intent: 'parent_search', confidence: 0.70 };
    }

    return { intent: 'unknown', confidence: 0.0 };
  }
}
