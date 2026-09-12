export interface Comparison {
  type: 'requirement' | 'numeric' | 'stat' | 'fact';
  metric?: string;
  first: number | string;
  second: number | string;
  difference?: number;
  higher?: number | string;
  lower?: number | string;
  status?: 'below_requirement' | 'meets_requirement' | 'exceeds_requirement' | 'equal' | 'greater' | 'less';
  description: string;
}

export class ComparisonEngine {
  /**
   * Compares a current value against a requirement
   */
  public compareRequirement(
    current: number,
    required: number,
    metric = 'Fans'
  ): Comparison {
    const difference = Math.abs(required - current);
    let status: Comparison['status'] = 'equal';

    if (current < required) {
      status = 'below_requirement';
    } else if (current > required) {
      status = 'exceeds_requirement';
    } else {
      status = 'meets_requirement';
    }

    return {
      type: 'requirement',
      metric,
      first: current,
      second: required,
      difference,
      status,
      higher: Math.max(current, required),
      lower: Math.min(current, required),
      description:
        status === 'below_requirement'
          ? `${metric} is ${difference.toLocaleString()} below requirement (${current.toLocaleString()} / ${required.toLocaleString()})`
          : `${metric} requirement met (${current.toLocaleString()} / ${required.toLocaleString()})`
    };
  }

  /**
   * Compares two numeric values
   */
  public compareNumbers(
    a: number,
    b: number,
    label = 'Value'
  ): Comparison {
    const difference = Math.abs(a - b);
    let status: Comparison['status'] = 'equal';
    if (a > b) status = 'greater';
    if (a < b) status = 'less';

    return {
      type: 'numeric',
      metric: label,
      first: a,
      second: b,
      difference,
      higher: Math.max(a, b),
      lower: Math.min(a, b),
      status,
      description: `${label}: ${a} vs ${b} (diff: ${difference})`
    };
  }

  /**
   * Compares two numbers directly
   */
  public compare(a: number, b: number, metric = 'Value'): Comparison {
    return this.compareNumbers(a, b, metric);
  }

  /**
   * Compares two character/support stats
   */
  public compareStats(
    statName: string,
    val1: number,
    val2: number
  ): Comparison {
    const difference = Math.abs(val1 - val2);
    const higher = Math.max(val1, val2);
    const lower = Math.min(val1, val2);

    return {
      type: 'stat',
      metric: statName,
      first: val1,
      second: val2,
      difference,
      higher,
      lower,
      status: val1 > val2 ? 'greater' : val1 < val2 ? 'less' : 'equal',
      description: `${statName}: higher is ${higher}, lower is ${lower} (difference: ${difference})`
    };
  }
}
