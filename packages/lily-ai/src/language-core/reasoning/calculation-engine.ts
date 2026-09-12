export interface CalculationResult {
  operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'percentage' | 'ratio' | 'progress';
  operands: number[];
  result: number;
  formatted: string;
}

export class CalculationEngine {
  public add(a: number, b: number): CalculationResult {
    const res = a + b;
    return {
      operation: 'add',
      operands: [a, b],
      result: res,
      formatted: `${a} + ${b} = ${res}`
    };
  }

  public subtract(a: number, b: number): CalculationResult {
    const res = a - b;
    return {
      operation: 'subtract',
      operands: [a, b],
      result: res,
      formatted: `${a} - ${b} = ${res}`
    };
  }

  public multiply(a: number, b: number): CalculationResult {
    const res = a * b;
    return {
      operation: 'multiply',
      operands: [a, b],
      result: res,
      formatted: `${a} * ${b} = ${res}`
    };
  }

  public divide(a: number, b: number): CalculationResult {
    if (b === 0) {
      return {
        operation: 'divide',
        operands: [a, b],
        result: 0,
        formatted: `${a} / 0 = undefined (division by zero)`
      };
    }
    const res = a / b;
    return {
      operation: 'divide',
      operands: [a, b],
      result: res,
      formatted: `${a} / ${b} = ${res}`
    };
  }

  public percentage(part: number, total: number): CalculationResult {
    if (total === 0) {
      return {
        operation: 'percentage',
        operands: [part, total],
        result: 0,
        formatted: '0%'
      };
    }
    const pct = (part / total) * 100;
    const rounded = Math.round(pct * 100) / 100;
    return {
      operation: 'percentage',
      operands: [part, total],
      result: rounded,
      formatted: `${rounded}%`
    };
  }

  public ratio(a: number, b: number): CalculationResult {
    if (b === 0) {
      return {
        operation: 'ratio',
        operands: [a, b],
        result: 0,
        formatted: `${a}:0`
      };
    }
    const res = a / b;
    return {
      operation: 'ratio',
      operands: [a, b],
      result: Math.round(res * 100) / 100,
      formatted: `${Math.round(res * 100) / 100}:1`
    };
  }

  public progress(current: number, target: number): { progress: number; formatted: string } {
    if (target === 0) {
      return { progress: 100, formatted: '100%' };
    }
    const pct = Math.round((current / target) * 100);
    return {
      progress: pct,
      formatted: `${pct}%`
    };
  }
}
