import { LanguageAnalysis } from '../language/language-analysis.js';

export interface ClassificationResult {
  domain: string;
  confidence: number;
  reasoning: string;
}

export class KnowledgeClassifier {
  public classify(analysis: LanguageAnalysis): ClassificationResult {
    const msg = analysis.normalizedMessage;
    
    // Account Linking Intents (B4)
    if (
      analysis.intent === 'link_request' ||
      analysis.intent === 'link_status' ||
      analysis.intent === 'link_help'
    ) {
      return {
        domain: 'account_linking',
        confidence: 0.98,
        reasoning: 'Link request, status, and help require direct database access and specific account linking logic.'
      };
    }

    // Check for trainer queries (profile, lookup, link status)
    if (
      analysis.intent === 'trainer_profile' ||
      analysis.intent === 'trainer_lookup' ||
      analysis.intent === 'trainer_link_status' ||
      analysis.intent === 'trainer_search' ||
      analysis.intent === 'trainer_stats' ||
      msg.includes('profile') ||
      msg.includes('linked') ||
      msg.includes('trainer') ||
      analysis.entities.some(e => e.type === 'trainer_id')
    ) {
      return {
        domain: 'trainer_data',
        confidence: 0.98,
        reasoning: 'Trainer identity and profile data must resolve strictly from database (never handbook, taxonomy, or web search)'
      };
    }

    // Check for club leaderboard and club statistics queries
    if (
      analysis.intent === 'leaderboard' ||
      analysis.intent === 'member_rank' ||
      analysis.intent === 'top_members' ||
      analysis.intent === 'club_stats' ||
      analysis.intent === 'fan_leaderboard' ||
      msg.includes('leaderboard') ||
      msg.includes('top 10') ||
      msg.includes('top members') ||
      msg.includes('club stats') ||
      msg.includes('club overview') ||
      msg.includes('how is the club doing') ||
      msg.includes('what rank am i') ||
      msg.includes('my rank')
    ) {
      return {
        domain: 'club_data',
        confidence: 0.98,
        reasoning: 'Club leaderboard, member ranking, and club statistics must resolve strictly from database (never handbook, taxonomy, or web search)'
      };
    }

    // 4. Handbook Knowledge Domains (B5)
    
    // Parent Search
    if (analysis.intent === 'parent_search') {
      return { domain: 'parent_search', confidence: 1.0, reasoning: 'Explicit parent search intent' };
    }

    // Uma Knowledge Intents
    if (analysis.intent === 'character_info') {
        return { domain: 'character_info', confidence: 1.0, reasoning: 'Explicit character info intent' };
    }
    if (analysis.intent === 'skill_info') {
        return { domain: 'skill_info', confidence: 1.0, reasoning: 'Explicit skill info intent' };
    }
    if (analysis.intent === 'support_info') {
        return { domain: 'support_info', confidence: 1.0, reasoning: 'Explicit support card info intent' };
    }
    if (analysis.intent === 'race_info') {
        return { domain: 'race_info', confidence: 1.0, reasoning: 'Explicit race info intent' };
    }
    if (analysis.intent === 'track_info') {
        return { domain: 'track_info', confidence: 1.0, reasoning: 'Explicit track info intent' };
    }
    // Build Advisor Intents
    if (analysis.intent === 'build_advice' || analysis.intent === 'build_analysis' || analysis.intent === 'build_recommendation') {
        return { domain: 'build_advice', confidence: 1.0, reasoning: 'Explicit build advice intent' };
    }

    // Training Advisor Intents
    if (analysis.intent === 'training_advice' || analysis.intent === 'turn_advice' || analysis.intent === 'event_choice' || analysis.intent === 'skill_purchase') {
        return { domain: 'training_advice', confidence: 1.0, reasoning: 'Explicit training advice intent' };
    }

    // Career Planner Intents
    if (analysis.intent === 'career_plan' || analysis.intent === 'run_planner' || analysis.intent === 'team_builder' || analysis.intent === 'race_plan') {
        return { domain: 'career_plan', confidence: 1.0, reasoning: 'Explicit career/team planning intent' };
    }

    // Meta Intelligence Intents
    if (analysis.intent === 'meta_analysis' || analysis.intent === 'competition_advice' || analysis.intent === 'counter_build' || analysis.intent === 'matchup_analysis' || analysis.intent === 'tier_list') {
        return { domain: 'meta_analysis', confidence: 1.0, reasoning: 'Explicit meta analysis intent' };
    }

    // Learning Intelligence Intents
    if (analysis.intent === 'submit_feedback' || analysis.intent === 'track_outcome') {
        return { domain: 'learning', confidence: 1.0, reasoning: 'Explicit learning feedback intent' };
    }

    // Vision Analysis Intents
    if (analysis.intent === 'analyze_screenshot' || analysis.intent === 'extract_data') {
        return { domain: 'vision_analysis', confidence: 1.0, reasoning: 'Explicit vision analysis intent' };
    }

    // Skills, Characters, Tracks via Taxonomy
    if (analysis.taxonomyMatches.some(t => t.type === 'skill')) {
        return { domain: 'skill', confidence: 1.0, reasoning: 'Skill identified via taxonomy' };
    }
    if (analysis.taxonomyMatches.some(t => t.type === 'character')) {
        return { domain: 'character', confidence: 1.0, reasoning: 'Character identified via taxonomy' };
    }
    if (analysis.taxonomyMatches.some(t => t.type === 'track')) {
        return { domain: 'track', confidence: 1.0, reasoning: 'Track identified via taxonomy' };
    }
    if (msg.includes('fan') && (msg.includes('minimum') || msg.includes('requirement') || msg.includes('target') || msg.includes('150m'))) {
      return {
        domain: 'fan_requirements',
        confidence: 0.98,
        reasoning: 'Explicit query about monthly fan targets or requirements.'
      };
    }

    // Activity Rules
    if (msg.includes('inactive') || msg.includes('kick') || msg.includes('activity')) {
      return {
        domain: 'activity_rules',
        confidence: 0.98,
        reasoning: 'Query regarding club activity policies or consequences of inactivity.'
      };
    }

    // Linking
    if (msg.includes('link') || msg.includes('connect')) {
      return {
        domain: 'linking',
        confidence: 0.95,
        reasoning: 'Query about the account linking process or how to connect accounts.'
      };
    }

    // Membership
    if (msg.includes('join') || msg.includes('membership') || msg.includes('apply')) {
      return {
        domain: 'membership',
        confidence: 0.95,
        reasoning: 'Query about joining the club or membership status.'
      };
    }

    // Club Procedures & FAQ
    if (msg.includes('procedure') || msg.includes('process') || msg.includes('faq') || msg.includes('how do i') || msg.includes('what is')) {
      if (msg.includes('club') || msg.includes('review') || msg.includes('track')) {
        return {
          domain: msg.includes('procedure') ? 'club_procedures' : 'faq',
          confidence: 0.90,
          reasoning: 'Query about club-specific procedures or frequently asked questions.'
        };
      }
    }

    // Check for general club rules fallback
    if (msg.includes('club') || msg.includes('rule') || msg.includes('policy')) {
      return {
        domain: 'club_rules',
        confidence: 0.90,
        reasoning: 'General query about club rules or policies.'
      };
    }
    
    // Check for mechanics
    if (msg.includes('mechanic') || msg.includes('acceleration') || msg.includes('speed') || msg.includes('stamina') || msg.includes('position')) {
      // If it's just 'speed parent', it might not be mechanics. But for knowledge_query intent it is likely mechanics.
      return {
        domain: 'mechanics',
        confidence: 0.90,
        reasoning: 'Message contains gameplay mechanics keywords'
      };
    }
    
    // Check for character lore/skills
    if (analysis.taxonomyMatches.some(t => t.type === 'character') || msg.includes('unique skill')) {
      return {
        domain: 'character',
        confidence: 0.85,
        reasoning: 'Message contains character taxonomy matches or skill keywords'
      };
    }

    if (msg.includes('trainer') || analysis.entities.some(e => e.type === 'trainer_id')) {
      return {
        domain: 'trainer_data',
        confidence: 0.90,
        reasoning: 'Message mentions trainers or contains a trainer ID'
      };
    }

    if (msg.includes('fan') || msg.includes('gain')) {
      return {
        domain: 'fan_data',
        confidence: 0.90,
        reasoning: 'Message asks about fan statistics'
      };
    }
    
    // Default fallback
    return {
      domain: 'general',
      confidence: 0.50,
      reasoning: 'No specific domain keywords matched, defaulting to general'
    };
  }
}
