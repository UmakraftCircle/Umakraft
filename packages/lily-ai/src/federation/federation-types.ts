export enum TrustLevel {
  VERIFIED = 'VERIFIED',
  TRUSTED = 'TRUSTED',
  COMMUNITY = 'COMMUNITY',
  UNKNOWN = 'UNKNOWN'
}

export interface FederationNode {
  id: string;
  name: string;
  region: string;
  trustLevel: TrustLevel;
  enabled: boolean;
}

export interface SharedMetaTrends {
  strategy: string;
  localUsage: number;
  federatedUsage: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SharedParentDemand {
  lineage: string;
  requests: number;
  supply: number;
  shortageRisk: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CommunityBenchmark {
  metric: string;
  localValue: number;
  federatedAverage: number;
}

export interface OutboundPayload {
  nodeId: string;
  metaTrends: Record<string, number>;
  parentDemands: Record<string, { requests: number; supply: number }>;
  benchmarks: Record<string, number>;
  // Explicitly sanitize user data out
  trainers?: never;
  discordIds?: never;
  usernames?: never;
  privateMessages?: never;
}
