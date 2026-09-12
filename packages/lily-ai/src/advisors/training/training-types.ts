export interface BuildContext {
  archetype: string;
  targetStats: {
    speed: number;
    stamina: number;
    power: number;
    guts: number;
    wisdom: number;
  };
}

export interface TrainingContext {
  character: string;
  scenario: string;
  turn: number;
  energy: number;
  mood: string;
  stats: {
    speed: number;
    stamina: number;
    power: number;
    guts: number;
    wisdom: number;
  };
  supportCards: string[];
  buildContext?: BuildContext;
}

export interface TrainingRecommendation {
  action: string;
  confidence: number;
  reason: string;
  alternatives: string[];
}
