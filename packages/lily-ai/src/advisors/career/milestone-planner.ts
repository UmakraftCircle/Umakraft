import { StatMilestone } from './career-types.js';

export class MilestonePlanner {
  public generateMilestones(): StatMilestone[] {
    return [
      { turn: 24, speed: 250, stamina: 200, power: 200, guts: 150, wisdom: 150 },
      { turn: 48, speed: 500, stamina: 400, power: 400, guts: 300, wisdom: 300 },
      { turn: 72, speed: 800, stamina: 600, power: 600, guts: 500, wisdom: 500 }
    ];
  }
}
