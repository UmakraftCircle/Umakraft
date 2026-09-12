export interface TrainerEntity {
  trainerId: string;
  trainerName: string;
  linked: boolean;
  clubName: string;
  clubId?: string;
  linkedDiscordId?: string;
  avatarUrl?: string;
  joinedAt?: Date;
  status?: 'active' | 'inactive' | 'hiatus';
  notes?: string;
}

export interface ClubEntity {
  clubId: string;
  clubName: string;
  memberCount: number;
  maxMembers: number;
  totalFans: number;
  monthlyFanTarget: number;
  averageFans: number;
  status: 'Super Competitive' | 'Competitive' | 'Casual' | string;
  rank?: number;
  leaderTrainerId?: string;
}

export interface FanStatsEntity {
  trainerId: string;
  trainerName: string;
  totalFans: number;
  dailyGain: number;
  monthlyGain: number;
  currentDay: number;
  daysInMonth: number;
  currentMilestone: string;
  nextMilestone?: string;
  remainingFansToNextMilestone?: number;
  deficit?: number;
  surplus?: number;
  requiredDailyGain?: number;
  projectedMonthEnd?: number;
}

export interface LeaderboardEntryEntity {
  rank: number;
  trainerId: string;
  trainerName: string;
  fans: number;
  dailyGain: number;
  monthlyGain: number;
  linkedDiscordId?: string;
  milestoneTitle?: string;
}

export interface LinkRequestEntity {
  requestId: string;
  discordUserId: string;
  trainerId: string;
  trainerName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  reviewedAt?: Date;
  reviewerId?: string;
  rejectionReason?: string;
}

export interface MilestoneDefinitionEntity {
  id: string;
  title: string;
  requiredFans: number;
  description: string;
  tier: number;
}
