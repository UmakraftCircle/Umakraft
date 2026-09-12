export interface Fact {
  subject: string;
  attribute: string;
  value: any;
  raw?: string;
}

export class FactDetector {
  /**
   * Detects factual statements from text (e.g. stats, fans, level)
   */
  public detectFacts(text: string): Fact[] {
    const facts: Fact[] = [];
    const lines = text.split(/[\n\.]+/);

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      // 1. Match multiple stats (e.g., Speed: 1200 Stamina: 800)
      const statRegex = /(speed|stamina|power|guts|wit|wisdom)\s*[:=]?\s*(\d+)/gi;
      let statMatch;
      while ((statMatch = statRegex.exec(cleanLine)) !== null) {
        facts.push({
          subject: 'Character',
          attribute: statMatch[1].toLowerCase(),
          value: parseInt(statMatch[2], 10),
          raw: cleanLine
        });
      }

      // 2. Match fans (e.g. Trainer has 120M fans, or Current Fans: 120M, or Required Fans: 150M)
      const fanRegex = /(?:(current|required)\s+)?fans\s*[:=]?\s*(\d+(?:\.\d+)?[mMgG]?)|(?:has|got|need|needs)\s+(\d+(?:\.\d+)?[mMgG]?)\s+fans/i;
      const fanMatch = cleanLine.match(fanRegex);
      if (fanMatch) {
        const isRequired = cleanLine.toLowerCase().includes('required') || (fanMatch[1] && fanMatch[1].toLowerCase() === 'required');
        const rawVal = fanMatch[2] || fanMatch[3];
        if (rawVal) {
          let numVal = parseFloat(rawVal);
          if (rawVal.toLowerCase().endsWith('m')) {
            numVal *= 1_000_000;
          }
          facts.push({
            subject: 'Trainer',
            attribute: isRequired ? 'Required Fans' : 'Fans',
            value: numVal,
            raw: cleanLine
          });
        }
      }
    }

    return facts;
  }
}
