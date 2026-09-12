export interface Deduction {
  type: string;
  premise: string;
  conclusion: string;
  requirementMet?: boolean;
  possibleIssue?: string;
  confidence: number;
  details?: Record<string, any>;
}

export class DeductionEngine {
  /**
   * Infers logical deductions from numeric facts and requirements
   */
  public deduceFanRequirement(currentFans: number, requiredFans: number): Deduction {
    const met = currentFans >= requiredFans;
    return {
      type: 'fan_requirement',
      premise: `Current Fans: ${currentFans.toLocaleString()}, Required: ${requiredFans.toLocaleString()}`,
      conclusion: met ? 'Fan requirement is satisfied' : 'Fan requirement is NOT satisfied',
      requirementMet: met,
      confidence: 1.0,
      details: {
        currentFans,
        requiredFans,
        deficit: met ? 0 : requiredFans - currentFans,
        surplus: met ? currentFans - requiredFans : 0
      }
    };
  }

  /**
   * Infers stamina sufficiency given race distance and stamina value
   */
  public deduceStaminaSufficiency(distanceCategory: string, stamina: number): Deduction {
    const normalizedDistance = distanceCategory.toLowerCase();
    let minRecommendedStamina = 600;

    if (normalizedDistance.includes('long')) {
      minRecommendedStamina = 700;
    } else if (normalizedDistance.includes('medium')) {
      minRecommendedStamina = 550;
    } else if (normalizedDistance.includes('mile')) {
      minRecommendedStamina = 450;
    } else if (normalizedDistance.includes('sprint')) {
      minRecommendedStamina = 350;
    }

    const isDeficient = stamina < minRecommendedStamina;
    return {
      type: 'stat_sufficiency',
      premise: `Distance is ${distanceCategory} with Stamina ${stamina}`,
      conclusion: isDeficient
        ? `Stamina (${stamina}) is below recommended threshold (${minRecommendedStamina}) for ${distanceCategory}`
        : `Stamina (${stamina}) is sufficient for ${distanceCategory}`,
      possibleIssue: isDeficient ? 'insufficient_stamina' : undefined,
      requirementMet: !isDeficient,
      confidence: 0.95,
      details: {
        distance: distanceCategory,
        stamina,
        minRecommendedStamina
      }
    };
  }

  /**
   * General deductive reasoning given text and context facts
   */
  public deduceFromContext(facts: any[] = [], text = ''): Deduction[] {
    const deductions: Deduction[] = [];
    const normalized = text.toLowerCase();

    // 1. Check for stamina & long distance combinations
    const hasLongDistance =
      normalized.includes('long distance') ||
      normalized.includes('long') ||
      facts.some(f => String(f.value || f.text || f.name || '').toLowerCase().includes('long'));

    const staminaMatch = text.match(/stamina\s*[:=]?\s*(\d+)/i) || text.match(/(\d+)\s*stamina/i);
    let staminaVal = staminaMatch ? parseInt(staminaMatch[1], 10) : undefined;

    if (staminaVal === undefined) {
      const staminaFact = facts.find(f => (f.name || f.key || '').toLowerCase() === 'stamina');
      if (staminaFact && typeof staminaFact.value === 'number') {
        staminaVal = staminaFact.value;
      }
    }

    if (hasLongDistance && staminaVal !== undefined) {
      deductions.push(this.deduceStaminaSufficiency('Long Distance', staminaVal));
    }

    // 2. Fan requirement deduction from text
    const fanMatches = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*m(?:illion)?\s*fans?/gi));
    const reqFanMatch = text.match(/require(?:d|ment)?(?:\s*is)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i);
    const trainerFanMatch = text.match(/trainer\s*(?:has|with)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i) ||
      text.match(/current\s*(?:fans)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i);

    if (reqFanMatch && (trainerFanMatch || fanMatches.length >= 2)) {
      const reqVal = parseFloat(reqFanMatch[1]) * 1_000_000;
      const currentVal = trainerFanMatch
        ? parseFloat(trainerFanMatch[1]) * 1_000_000
        : parseFloat(fanMatches[0][1]) * 1_000_000;
      deductions.push(this.deduceFanRequirement(currentVal, reqVal));
    } else if (facts.length > 0) {
      const cur = facts.find(f => f.key === 'currentFans' || f.name === 'currentFans' || f.key === 'current');
      const req = facts.find(f => f.key === 'requiredFans' || f.name === 'requiredFans' || f.key === 'required');
      if (cur && req && typeof cur.value === 'number' && typeof req.value === 'number') {
        deductions.push(this.deduceFanRequirement(cur.value, req.value));
      }
    }

    return deductions;
  }

  /**
   * Deduce from direct input parameters
   */
  public deduce(input: {
    currentFans?: number;
    requiredFans?: number;
    distance?: string;
    stamina?: number;
    facts?: any[];
    text?: string;
  }): Deduction[] {
    const deductions: Deduction[] = [];

    if (input.currentFans !== undefined && input.requiredFans !== undefined) {
      deductions.push(this.deduceFanRequirement(input.currentFans, input.requiredFans));
    }

    if (input.distance && input.stamina !== undefined) {
      deductions.push(this.deduceStaminaSufficiency(input.distance, input.stamina));
    }

    if (input.text || (input.facts && input.facts.length > 0)) {
      const contextDeductions = this.deduceFromContext(input.facts, input.text || '');
      for (const d of contextDeductions) {
        if (!deductions.some(existing => existing.type === d.type && existing.premise === d.premise)) {
          deductions.push(d);
        }
      }
    }

    return deductions;
  }
}
