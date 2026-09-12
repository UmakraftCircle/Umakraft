export enum TierRank {
  SSS = 'SSS',
  SS = 'SS',
  S = 'S',
  A = 'A',
  B = 'B',
  C = 'C'
}

export enum MetaConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface MetaSnapshot {
  timestamp: Date;
  characters: Record<string, number>;
  skills: Record<string, number>;
  styles: Record<string, number>;
}
