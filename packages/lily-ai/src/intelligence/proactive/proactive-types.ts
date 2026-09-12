export enum IntelligencePriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW'
}

export interface NotificationScore {
  usefulness: number;
  urgency: number;
  confidence: number;
}

export interface TrainerProfile {
  strengths: string[];
  weaknesses: string[];
  goals: string[];
}

export interface Notification {
  title: string;
  message: string;
  priority: IntelligencePriority;
  score: NotificationScore;
}
