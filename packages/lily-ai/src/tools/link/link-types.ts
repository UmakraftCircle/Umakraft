import { ToolResult } from '../../services/tools/tool-result.js';
import { LinkRequestStatus } from '../../../../integrations/src/link-requests.js';

export interface LinkRequest {
  discordUserId: string;
  trainerId: string;
  trainerName: string;
  status: 'pending';
}

export interface LinkRequestResult extends ToolResult {
  data?: {
    requestId?: string;
    status?: 'pending' | LinkRequestStatus;
    alreadyLinked?: boolean;
    trainerId?: string;
    missingFields?: string[];
  };
}

export interface LinkStatusResult extends ToolResult {
  data: {
    linked: boolean;
    status: 'pending' | 'approved' | 'rejected' | 'none';
    trainerId?: string;
    trainerName?: string;
  };
}

export interface LeaderLinkNotification {
  requestId: string;
  discordUserId: string;
  trainerId: string;
  trainerName: string;
  submittedAt: Date;
}

export const FORBIDDEN_LINK_DATA_SOURCES = ['handbook', 'lily_handbook', 'taxonomy', 'web_search', 'uma.guide'] as const;
export const ACCOUNT_LINKING_DOMAIN = 'account_linking';
export const LINK_DATA_SOURCE = 'database';
