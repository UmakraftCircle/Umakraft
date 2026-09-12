export enum ForecastConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface ClubHealth {
  memberHealth: number;
  fanCompliance: number;
  parentCoverage: number;
  activityLevel: number;
  growthScore: number;
}

export interface FanPrediction {
  currentFans: number;
  predictedEndOfMonth: number;
  risk: string;
  probabilityOfFailure: number;
  confidence: ForecastConfidence;
}

export interface LeaderboardForecast {
  currentRank: number;
  projectedRank: number;
  confidence: ForecastConfidence;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface ParentDemandForecastResult {
  strategy: string;
  currentSupply: number;
  expectedDemand: number;
  shortageProbability: number;
  confidence: ForecastConfidence;
}

export interface MetaPredictionResult {
  strategy: string;
  currentUsage: number;
  projectedUsage: number;
  confidence: ForecastConfidence;
}

export interface AnomalyResult {
  metric: string;
  baseline: number;
  observed: number;
  isAnomaly: boolean;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RiskAlert {
  type: string;
  probabilityOfFailure: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}
