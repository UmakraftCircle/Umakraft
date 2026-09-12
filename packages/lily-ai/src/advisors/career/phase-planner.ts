import { CareerPhase } from './career-types.js';

export class PhasePlanner {
  public getPhaseFocus(phase: CareerPhase): string {
    switch (phase) {
      case CareerPhase.EARLY: return 'Focus support bonds.';
      case CareerPhase.MID: return 'Prioritize Speed and Stamina.';
      case CareerPhase.LATE: return 'Reach 1200 Speed and 900 Stamina.';
      case CareerPhase.FINALS: return 'Race Optimization.';
    }
  }
}
