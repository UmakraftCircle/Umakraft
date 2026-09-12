export interface NumberFact {
  original: string;
  value: number;
  unit?: string;
}

export class NumericComprehension {
  /**
   * Normalizes numeric strings like 150M, 1B, 1,000, 2500m to raw numbers
   */
  public parseNumber(text: string): number | null {
    const trimmed = text.replace(/,/g, '').trim();
    const clean = trimmed.toLowerCase();
    
    if (trimmed.endsWith('M')) {
      const val = parseFloat(clean.slice(0, -1));
      return isNaN(val) ? null : val * 1_000_000;
    }
    
    if (clean.endsWith('m')) {
      const val = parseFloat(clean.slice(0, -1));
      if (isNaN(val)) return null;
      // If suffix is lowercase 'm' and value represents a typical distance (>= 400 and multiple of 100)
      if (val >= 400 && val % 100 === 0) {
        return val; // meters
      }
      return val * 1_000_000; // millions
    }
    
    // Check billions
    if (clean.endsWith('b')) {
      const val = parseFloat(clean.slice(0, -1));
      return isNaN(val) ? null : val * 1_000_000_000;
    }
    
    const plainVal = parseFloat(clean);
    return isNaN(plainVal) ? null : plainVal;
  }

  /**
   * Identifies numbers in text and returns normalized NumberFacts
   */
  public extractNumbers(text: string): NumberFact[] {
    const matches: NumberFact[] = [];
    const regex = /(\b\d+(?:\.\d+)?(?:[mMbB]|k|K)?\b|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const original = match[1];
      const value = this.parseNumber(original);
      if (value !== null) {
        let unit: string | undefined;
        if (original.endsWith('M')) {
          unit = 'millions';
        } else if (original.toLowerCase().endsWith('m') && !original.toLowerCase().includes(',')) {
          const val = parseFloat(original.slice(0, -1));
          unit = (val >= 400 && val % 100 === 0) ? 'meters' : 'millions';
        } else if (original.toLowerCase().endsWith('b')) {
          unit = 'billions';
        }
        matches.push({ original, value, unit });
      }
    }
    return matches;
  }

  /**
   * Calculates progress ratio or completion percentage between two extracted numbers
   */
  public calculateProgress(current: number, required: number): number {
    if (required === 0) return 0;
    return Math.round((current / required) * 100);
  }
}
