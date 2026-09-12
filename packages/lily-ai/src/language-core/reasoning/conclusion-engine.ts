import { Deduction } from './deduction-engine.js';
import { Comparison } from './comparison-engine.js';

export interface Conclusion {
  type: string;
  statement: string;
  remaining?: number;
  remainingFans?: number;
  surplus?: number;
  goalReached?: boolean;
  requirementMet?: boolean;
  confidence: number;
  details?: Record<string, any>;
}

export class ConclusionEngine {
  /**
   * Conclude from structured fan numbers
   */
  public concludeFanTarget(currentFans: number, requiredFans: number): Conclusion {
    const goalReached = currentFans >= requiredFans;
    const remaining = goalReached ? 0 : requiredFans - currentFans;
    const surplus = goalReached ? currentFans - requiredFans : 0;

    return {
      type: 'fan_target',
      statement: goalReached
        ? `Fan requirement satisfied with ${surplus.toLocaleString()} surplus fans`
        : `${remaining.toLocaleString()} fans remaining to reach target requirement`,
      remaining,
      remainingFans: remaining,
      surplus,
      goalReached,
      requirementMet: goalReached,
      confidence: 1.0,
      details: {
        currentFans,
        requiredFans,
        remaining,
        remainingFans: remaining,
        surplus,
        goalReached,
        requirementMet: goalReached
      }
    };
  }

  /**
   * Generates structured conclusions from context, comparisons, deductions, or direct inputs
   * NOTE: Conclusions state facts, deficits, and statuses only.
   * Recommendations or action suggestions are strictly prohibited.
   */
  public conclude(input: {
    currentFans?: number;
    requiredFans?: number;
    facts?: any[];
    deductions?: Deduction[];
    comparisons?: Comparison[];
    text?: string;
  }): Conclusion[] {
    const conclusions: Conclusion[] = [];

    // 1. Fan target evaluation
    if (input.currentFans !== undefined && input.requiredFans !== undefined) {
      conclusions.push(this.concludeFanTarget(input.currentFans, input.requiredFans));
    } else if (input.text) {
      const text = input.text;
      const reqMatch = text.match(/require(?:d|ment)?(?:\s*is)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i);
      const curMatch =
        text.match(/trainer\s*(?:has|with)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i) ||
        text.match(/current\s*(?:fans)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i) ||
        text.match(/(\d+(?:\.\d+)?)\s*m\s*fans/i);

      if (reqMatch && curMatch) {
        const reqFans = parseFloat(reqMatch[1]) * 1_000_000;
        const curFans = parseFloat(curMatch[1]) * 1_000_000;
        conclusions.push(this.concludeFanTarget(curFans, reqFans));
      }
    }

    // 2. Synthesize from deductions
    if (input.deductions) {
      for (const d of input.deductions) {
        if (d.type === 'fan_requirement' && !conclusions.some(c => c.type === 'fan_target')) {
          conclusions.push({
            type: 'fan_target',
            statement: d.conclusion,
            requirementMet: d.requirementMet,
            goalReached: d.requirementMet,
            remaining: d.requirementMet ? 0 : d.details?.deficit,
            remainingFans: d.requirementMet ? 0 : d.details?.deficit,
            surplus: d.details?.surplus,
            confidence: d.confidence
          });
        } else if (d.type === 'stat_sufficiency') {
          conclusions.push({
            type: 'stat_status',
            statement: d.conclusion,
            requirementMet: d.requirementMet,
            confidence: d.confidence,
            details: {
              possibleIssue: d.possibleIssue
            }
          });
        }
      }
    }

    // 3. Synthesize from comparisons
    if (input.comparisons) {
      for (const comp of input.comparisons) {
        if (comp.type === 'requirement' && !conclusions.some(c => c.type === 'fan_target')) {
          const met = comp.status === 'meets_requirement' || comp.status === 'exceeds_requirement';
          const remaining = comp.status === 'below_requirement' ? (comp.difference || 0) : 0;
          conclusions.push({
            type: 'requirement_status',
            statement: comp.description,
            remaining,
            remainingFans: remaining,
            goalReached: met,
            requirementMet: met,
            confidence: 0.95
          });
        }
      }
    }

    return conclusions;
  }
}
