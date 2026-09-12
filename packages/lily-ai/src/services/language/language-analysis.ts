export type IntentType =
  | 'parent_search'
  | 'trainer_search'
  | 'trainer_stats'
  | 'trainer_profile'
  | 'trainer_lookup'
  | 'trainer_link_status'
  | 'fan_query'
  | 'fan_gain'
  | 'fan_deficit'
  | 'fan_surplus'
  | 'fan_projection'
  | 'fan_milestone'
  | 'fan_leaderboard'
  | 'leaderboard'
  | 'member_rank'
  | 'club_stats'
  | 'top_members'
  | 'link_request'
  | 'link_status'
  | 'link_help'
  | 'fan_requirements'
  | 'activity_rules'
  | 'linking'
  | 'membership'
  | 'club_procedures'
  | 'faq'
  | 'knowledge_query'
  | 'general_chat'
  | 'character_info'
  | 'skill_info'
  | 'support_info'
  | 'race_info'
  | 'track_info'
  | 'build_advice'
  | 'build_analysis'
  | 'build_recommendation'
  | 'training_advice'
  | 'turn_advice'
  | 'event_choice'
  | 'skill_purchase'
  | 'career_plan'
  | 'run_planner'
  | 'team_builder'
  | 'race_plan'
  | 'meta_analysis'
  | 'competition_advice'
  | 'counter_build'
  | 'matchup_analysis'
  | 'tier_list'
  | 'submit_feedback'
  | 'track_outcome'
  | 'analyze_screenshot'
  | 'extract_data'
  | 'unknown';

export interface TaxonomyMatch {
  value: string;
  type: string;
}

export interface ExtractedEntity {
  value: string;
  type: 'trainer_id' | 'number' | 'unknown';
}

export interface LanguageAnalysis {
  intent: IntentType;
  confidence: number;
  taxonomyMatches: TaxonomyMatch[];
  entities: ExtractedEntity[];
  normalizedMessage: string;
  trainerId?: string;
}
