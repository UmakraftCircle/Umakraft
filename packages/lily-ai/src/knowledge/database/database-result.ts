export interface DatabaseKnowledgeResult {
  source: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  confidence: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  authority?: number;
}

export type DatabaseEntityType =
  | 'trainer'
  | 'member'
  | 'club'
  | 'fan_gain'
  | 'fan_deficit'
  | 'fan_surplus'
  | 'leaderboard'
  | 'link_request'
  | 'milestone'
  | 'attendance'
  | 'activity_tracking'
  | 'bot_configuration'
  | 'composite_status';

export interface DatabaseQueryOptions {
  entityType?: DatabaseEntityType | string;
  entityId?: string;
  term?: string;
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  userContext?: UserSecurityContext;
}

export interface UserSecurityContext {
  userId?: string;
  discordUserId?: string;
  trainerId?: string;
  roles?: ('public' | 'member' | 'officer' | 'admin' | 'super_admin' | string)[];
  isAdmin?: boolean;
  isOfficer?: boolean;
}
