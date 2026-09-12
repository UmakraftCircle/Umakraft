export enum CareerPhase {
  EARLY = 'early',
  MID = 'mid',
  LATE = 'late',
  FINALS = 'finals'
}

export interface StatMilestone {
  turn: number;
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
}

export interface CareerPlan {
  character: string;
  buildGoal: string;
  milestones: StatMilestone[];
  racePlan: string[];
  parentPlan: string[];
  skillPlan: string[];
}
