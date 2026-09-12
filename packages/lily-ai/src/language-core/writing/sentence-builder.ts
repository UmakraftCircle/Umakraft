export interface SentenceComponents {
  subject: string;
  action: string;
  value: string;
}

export class SentenceBuilder {
  /**
   * Constructs a grammatically natural, well-formatted sentence from structured parts
   */
  public buildSentence(components: SentenceComponents): string {
    const { subject, action, value } = components;

    // Normalize value numbers (e.g., 30M -> 30 million)
    const normalizedValue = this.normalizeValue(value);

    // Adjust word cases and glue together
    const cleanSubject = subject.trim();
    const cleanAction = action.trim().toLowerCase();

    // Construct sentence
    let sentence = `${cleanSubject} ${cleanAction} ${normalizedValue}`;

    // Capitalize first letter
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);

    // Add trailing punctuation if missing
    if (!/[.!?]$/.test(sentence)) {
      sentence += '.';
    }

    return sentence;
  }

  private normalizeValue(val: string): string {
    let clean = val.trim();

    // Replace suffixes within words (e.g. 30M -> 30 million, 2500m -> 2500 meters)
    clean = clean.replace(/\b(\d+(?:\.\d+)?)([mMbB])\b/g, (match, num, unit) => {
      const parsedNum = parseFloat(num);
      const lowerUnit = unit.toLowerCase();
      if (lowerUnit === 'm') {
        // If it looks like a typical distance unit (e.g., 2500m), format as meters
        if (parsedNum >= 400 && parsedNum % 100 === 0) {
          return `${parsedNum} meters`;
        }
        return `${parsedNum} million`;
      }
      if (lowerUnit === 'b') {
        return `${parsedNum} billion`;
      }
      return match;
    });

    return clean;
  }
}
