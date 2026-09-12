export class Summarizer {
  /**
   * Compresses input text into a summary of requested depth (Short, Medium, Detailed)
   */
  public summarize(text: string, depth: 'short' | 'medium' | 'detailed' = 'medium'): string {
    const cleanText = text.trim();
    if (!cleanText) return '';

    // Split into sentences
    const sentences = cleanText
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) return '';

    switch (depth) {
      case 'short':
        // Return only the first/primary sentence or a tightly condensed statement
        return sentences[0];

      case 'medium':
        // Return up to 2 primary sentences
        return sentences.slice(0, 2).join(' ');

      case 'detailed':
      default:
        // Return the first 3 or 4 sentences
        return sentences.slice(0, Math.min(4, sentences.length)).join(' ');
    }
  }
}
