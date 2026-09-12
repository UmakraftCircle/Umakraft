export interface ExtractedInfo {
  numbers: number[];
}

export class ReadingEngine {
  /**
   * Identifies and extracts numbers from the text input
   */
  public extractInfo(text: string): ExtractedInfo {
    const numbers: number[] = [];
    // Match standard integers and decimals, plus M/K shorthand multiplier if desired, or just raw numbers
    const regex = /(\d+(?:\.\d+)?)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }

    return {
      numbers
    };
  }
}
