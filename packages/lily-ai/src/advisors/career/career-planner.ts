import { CareerPlan } from './career-types.js';
import { PhasePlanner } from './phase-planner.js';
import { RacePlanner } from './race-planner.js';
import { InheritancePlanner } from './inheritance-planner.js';
import { MilestonePlanner } from './milestone-planner.js';

export class CareerPlanner {
  private phasePlanner = new PhasePlanner();
  private racePlanner = new RacePlanner();
  private inheritancePlanner = new InheritancePlanner();
  private milestonePlanner = new MilestonePlanner();

  public plan(character: string, goal: string, style: string): CareerPlan {
    return {
      character,
      buildGoal: goal,
      milestones: this.milestonePlanner.generateMilestones(),
      racePlan: this.racePlanner.planRaces(goal),
      parentPlan: this.inheritancePlanner.planParentStrategy(style),
      skillPlan: ['Concentration', 'Professor of Curvature']
    };
  }
}
