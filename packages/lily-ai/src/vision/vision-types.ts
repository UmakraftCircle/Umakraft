export interface OCRResult {
  text: string;
  confidence: number;
}

export enum VisionConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface Stats {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
}

export interface TrainingScreen {
  energy: number;
  stats: Stats;
  turn: number;
  supportsPresent: string[];
  availableTrainings: string[];
  confidence: VisionConfidence;
}
