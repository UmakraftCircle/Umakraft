export interface Deduction {
  type: string;
  premise: string;
  conclusion: string;
  requirementMet?: boolean;
  possibleIssue?: string;
  confidence: number;
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
      confidence: 1.0
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
      confidence: 0.95
    };
  }

  /**
   * General deductive reasoning given text and context facts
   */
  public deduceFromContext(facts: any[], text: string): Deduction[] {
    const deductions: Deduction[] = [];
    const normalized = text.toLowerCase();

    // Check for stamina & long distance combinations
    const hasLongDistance =
      normalized.includes('long distance') ||
      normalized.includes('long') ||
      facts.some(f => String(f.value || f.text || '').toLowerCase().includes('long'));

    const staminaMatch = text.match(/stamina\s*(\d+)/i) || text.match(/(\d+)\s*stamina/i);
    if (hasLongDistance && staminaMatch) {
      const staminaVal = parseInt(staminaMatch[1], 10);
      if (staminaVal < 600) {
        deductions.push({
          type: 'stat_deficiency',
          premise: `Long distance race with ${staminaVal} stamina`,
          conclusion: 'Stamina value is deficient for long distance endurance requirements',
          possibleIssue: 'insufficient_stamina',
          confidence: 0.95
        });
      }
    }

    // Fan requirement deduction
    const currentFanMatch = text.match(/(\d+)\s*m(?:illion)?\s*fans/i);
    const reqFanMatch = text.match(/require(?:d|ment)?(?:\s*is)?\s*(\d+)\s*m/i);
    if (currentFanMatch && reqFanMatch) {
      const current = parseInt(currentFanMatch[1], 10);
      const req = parseInt(reqFanMatch[1], 10);
      deductions.push(this.deduceFanRequirement(current * 1000000, req * 1000000));
    }

    return deductions;
  }
}
