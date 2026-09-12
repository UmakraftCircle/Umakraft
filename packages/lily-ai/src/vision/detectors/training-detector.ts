import { TrainingScreen, VisionConfidence } from '../vision-types.js';

export class TrainingDetector {
  public detect(data: any): TrainingScreen {
    return {
      energy: data.energy,
      stats: { speed: data.stats.speed, stamina: 0, power: 0, guts: 0, wisdom: 0 },
      turn: 1,
      supportsPresent: [],
      availableTrainings: [],
      confidence: VisionConfidence.HIGH
    };
  }
}
